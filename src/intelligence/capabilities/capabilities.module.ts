import { Module } from '@nestjs/common';
import { InsightsExtractionModule } from './insights-extraction/insights-extraction.module';
import { InsightExtractionCapability } from './insights-extraction/insight-extraction.capability';
import { KnowledgeGraphExtractionModule } from './knowledge-graph-extraction/knowledge-graph-extraction.module';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction/knowledge-graph-extraction.capability';
import { InsightsExtractionV2Module } from './insights-extraction-v2/insights-extraction-v2.module';
import { InsightExtractionCapabilityV2 } from './insights-extraction-v2/insight-extraction-v2.capability';
import { MergeModule } from '../merge/merge.module';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';

@Module({
    imports: [
        InsightsExtractionModule,
        KnowledgeGraphExtractionModule,
        InsightsExtractionV2Module,
        MergeModule,
    ],
    providers: [
        CapabilityManager,
        {
            provide: CAPABILITY,
            useFactory: (
                insightService: InsightExtractionCapability,
                kgService: KnowledgeGraphExtractionCapability,
                insightV2Service: InsightExtractionCapabilityV2,
            ) => [kgService, insightV2Service], // V2 is used by default in intelligence pipeline
            inject: [
                InsightExtractionCapability,
                KnowledgeGraphExtractionCapability,
                InsightExtractionCapabilityV2,
            ],
        },
    ],
    exports: [
        CapabilityManager,
        MergeModule,
        KnowledgeGraphExtractionModule,
        InsightsExtractionV2Module,
    ],
})
export class CapabilitiesModule {}
