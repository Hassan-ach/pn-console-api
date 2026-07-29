import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnterpriseContextBuilder } from './context/builders/enterprise-context-builder.abstract';
import { PreviousIntelligenceQuery } from './context/types/enterprise-context.types';
import { ChunkingPipeline } from './chunking/services/chunking-pipeline.service';
import { DataChunk } from './chunking/types/data-chunk.type';
import { CapabilityManager } from './capabilities/capability-manager.service';
import { InsightPersistenceService } from './store/insight-persistence.service';
import { CapabilityFailureRepository } from '../repositories/capability-failure.repository';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import { OnEvent } from '@nestjs/event-emitter';
import { EnvelopesIngestedEvent } from '../ingestion/events/ingestion.events';
import {
    IntelligenceJobStartedEvent,
    IntelligenceJobMessageEvent,
    IntelligenceJobCompletedEvent,
    IntelligenceJobFailedEvent,
} from '../jobs/events/intelligence-job.events';

@Injectable()
export class IntelligenceEngineService {
    private readonly logger = new Logger(IntelligenceEngineService.name);

    private readonly previousInsightLimit: number;

    constructor(
        private readonly contextBuilder: EnterpriseContextBuilder,
        private readonly pipeline: ChunkingPipeline,
        private readonly capabilityManager: CapabilityManager,
        private readonly persistence: InsightPersistenceService,
        private readonly failureRepository: CapabilityFailureRepository,
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly config: ConfigService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        this.previousInsightLimit = this.config.get<number>(
            'engine.previousInsightLimit',
            5,
        );
    }

    @OnEvent('envelopes.ingested')
    async handleEnvelopesIngested(event: EnvelopesIngestedEvent): Promise<void> {
        this.logger.log(
            `Received envelopes.ingested event: org=${event.organizationId}, count=${event.envelopeIds.length}`,
        );
        await this.run(event.organizationId, {
            envelopeIds: event.envelopeIds,
            userId: event.userId,
            progressable: event.isBackfill,
        });
    }

    async run(
        organizationId: string,
        opts?: {
            userId?: string;
            envelopeIds?: string[];
            windowStart?: Date;
            windowEnd?: Date;
            progressable?: boolean;
        },
    ): Promise<{ insightsPersisted: number }> {
        this.logger.log(
            `Starting intelligence run: org=${organizationId}${
                opts?.envelopeIds?.length
                    ? `, ids=${opts.envelopeIds.length}`
                    : ''
            }${opts?.windowStart ? `, window=${String(opts.windowStart)}–${String(opts.windowEnd)}` : ''}`,
        );

        let jobId: string | undefined;

        if (opts?.userId) {
            const results = (await this.eventEmitter.emitAsync(
                'job.intelligence.started',
                new IntelligenceJobStartedEvent(
                    organizationId,
                    opts.userId,
                    'Intelligence Run',
                    opts.progressable ?? false,
                    'Processing envelopes',
                ),
            )) as Array<{ jobId?: string }>;
            const result = results?.[0];
            if (result?.jobId) {
                jobId = result.jobId;
            }
        }

        try {
            const result = await this.executeRun(organizationId, opts, jobId);
            if (jobId) {
                this.eventEmitter.emit(
                    'job.intelligence.completed',
                    new IntelligenceJobCompletedEvent(
                        jobId,
                        `${result.insightsPersisted} insights persisted`,
                    ),
                );
            }
            return result;
        } catch (error) {
            if (jobId) {
                this.eventEmitter.emit(
                    'job.intelligence.failed',
                    new IntelligenceJobFailedEvent(
                        jobId,
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                    ),
                );
            }
            throw error;
        }
    }

    private async executeRun(
        organizationId: string,
        opts?: {
            userId?: string;
            envelopeIds?: string[];
            windowStart?: Date;
            windowEnd?: Date;
        },
        jobId?: string,
    ): Promise<{ insightsPersisted: number }> {
        const startedAt = Date.now();
        let totalInsights = 0;
        let windowCount = 0;

        for await (const ctx of this.contextBuilder.build(organizationId, {
            envelopeIds: opts?.envelopeIds,
            windowStart: opts?.windowStart,
            windowEnd: opts?.windowEnd,
        })) {
            windowCount++;

            if (ctx.envelopes.length === 0) {
                this.logger.debug(`Window ${windowCount}: empty, skipping`);
                continue;
            }

            this.logger.log(
                `Window ${windowCount}: ${ctx.envelopes.length} envelopes [${ctx.window.start?.toISOString()} – ${ctx.window.end?.toISOString()}]`,
            );

            if (jobId) {
                this.eventEmitter.emit(
                    'job.intelligence.message',
                    new IntelligenceJobMessageEvent(
                        jobId,
                        `Processing window ${windowCount}`,
                    ),
                );
            }

            for await (const chunk of this.pipeline.run(ctx.envelopes)) {
                const query = this.buildQuery(chunk);
                const previousInsights = await ctx.previousIntelligence(query);

                this.logger.debug(
                    `Chunk ${chunk.id}: ${chunk.envelopes.length} envelopes, ${previousInsights.length} previous insights`,
                );

                const { results, errors } =
                    await this.capabilityManager.executeAll({
                        chunk,
                        previousIntelligence: previousInsights,
                    });

                if (errors.length > 0) {
                    this.logger.warn(
                        `Capability errors for chunk ${chunk.id}: ${JSON.stringify(errors)}`,
                    );

                    const envelopeIds = chunk.envelopes
                        .map((e) => e.envelope.id)
                        .filter((id): id is string => !!id);

                    await this.failureRepository.createMany(
                        errors.map((err) => ({
                            capabilityName: err.capabilityName,
                            chunkId: chunk.id,
                            errorMessage: err.error,
                            envelopeIds,
                            organizationId,
                        })),
                    );
                }

                const insights = results.flatMap((r) => r.insights);
                if (insights.length > 0) {
                    await this.persistence.persistAll(insights, organizationId);
                    totalInsights += insights.length;
                }

                const envelopeIds = chunk.envelopes
                    .map((e) => e.envelope.id)
                    .filter((id): id is string => !!id);

                if (envelopeIds.length > 0) {
                    const allFailed =
                        errors.length > 0 &&
                        results.every((r) => r.insights.length === 0);
                    const status = allFailed ? 'FAILED' : 'READY';

                    await this.envelopeRepo.markStatus(envelopeIds, status);
                }
            }
        }

        this.logger.log(
            `Intelligence run complete: ${totalInsights} insights from ${windowCount} windows in ${Date.now() - startedAt}ms`,
        );

        return { insightsPersisted: totalInsights };
    }

    private buildQuery(chunk: DataChunk): PreviousIntelligenceQuery {
        const firstEnv = chunk.envelopes[0];
        if (!firstEnv) return { limit: this.previousInsightLimit };

        const scope: PreviousIntelligenceQuery['scope'] = {
            sourcePlugin: firstEnv.envelope.sourcePlugin,
        };

        if (firstEnv.payload.channelId || firstEnv.payload.topicId) {
            if (firstEnv.payload.channelId)
                scope.channelId = firstEnv.payload.channelId;
            if (firstEnv.payload.topicId)
                scope.topicId = firstEnv.payload.topicId;
        } else if (firstEnv.payload.groupId) {
            scope.groupId = firstEnv.payload.groupId;
        }

        return { scope, limit: this.previousInsightLimit };
    }
}
