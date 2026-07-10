import { Injectable, Logger } from '@nestjs/common';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { ChunkingPipeline } from './chunking/chunking-pipeline.service';
import { CapabilityManager } from './capabilities/capability-manager.service';
import { InsightPersistenceService } from './store/insight-persistence.service';
import { Insight } from '../types/insight.types';

@Injectable()
export class IntelligenceEngineService {
    private readonly logger = new Logger(IntelligenceEngineService.name);

    constructor(
        private readonly contextBuilder: EnterpriseContextBuilder,
        private readonly pipeline: ChunkingPipeline,
        private readonly capabilityManager: CapabilityManager,
        private readonly persistence: InsightPersistenceService,
    ) {}

    async run(
        organizationId: string,
        opts?: { envelopeIds?: string[]; windowStart?: Date; windowEnd?: Date },
    ): Promise<{ insightsPersisted: number }> {
        const ctx = this.contextBuilder.build(organizationId);

        const prevIntelligence: Insight[] = [];
        for await (const batch of ctx.previousIntelligence({})) {
            prevIntelligence.push(...batch);
        }

        let totalInsights = 0;

        for await (const envBatch of ctx.envelopes({
            ids: opts?.envelopeIds,
            windowStart: opts?.windowStart,
            windowEnd: opts?.windowEnd,
        })) {
            if (envBatch.length === 0) continue;
            for await (const chunk of this.pipeline.run(envBatch)) {
                const { results, errors } =
                    await this.capabilityManager.executeAll({
                        chunk,
                        previousIntelligence: prevIntelligence,
                    });

                if (errors.length > 0) {
                    this.logger.warn(
                        `Capability errors: ${JSON.stringify(errors)}`,
                    );
                }

                const insights = results.flatMap((r) => r.insights);
                if (insights.length > 0) {
                    await this.persistence.persistAll(insights, organizationId);
                    totalInsights += insights.length;
                }
            }
        }

        return { insightsPersisted: totalInsights };
    }
}
