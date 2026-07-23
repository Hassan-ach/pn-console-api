import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnterpriseContextBuilder } from '../context/builders/enterprise-context-builder.abstract';
import { PreviousIntelligenceQuery } from '../context/types/enterprise-context.types';
import { ChunkingPipeline } from '../chunking/services/chunking-pipeline.service';
import { DataChunk } from '../chunking/types/data-chunk.type';
import { CapabilityManager } from '../capabilities/capability-manager.service';
import { InsightPersistenceService } from '../store/insight-persistence.service';
import { CapabilityFailureRepository } from '../../repositories/capability-failure.repository';
import { EnvelopeRepository } from '../../repositories/envelope.repository';

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
    ) {
        this.previousInsightLimit = this.config.get<number>(
            'engine.previousInsightLimit',
            5,
        );
    }

    async run(
        organizationId: string,
        opts?: { envelopeIds?: string[]; windowStart?: Date; windowEnd?: Date },
    ): Promise<{ insightsPersisted: number }> {
        this.logger.log(
            `Starting intelligence run: org=${organizationId}${
                opts?.envelopeIds?.length
                    ? `, ids=${opts.envelopeIds.length}`
                    : ''
            }${opts?.windowStart ? `, window=${opts.windowStart}–${opts.windowEnd}` : ''}`,
        );

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
