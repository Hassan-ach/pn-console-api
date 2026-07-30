import { Module } from '@nestjs/common';
import { InsightsExtractionModule } from './insights-extraction/insights-extraction.module';
import { InsightExtractionCapability } from './insights-extraction/insight-extraction.capability';
import { KnowledgeGraphExtractionModule } from './knowledge-graph-extraction/knowledge-graph-extraction.module';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction/knowledge-graph-extraction.capability';
import { MergeModule } from '../merge/merge.module';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';

@Module({
    imports: [
        InsightsExtractionModule,
        KnowledgeGraphExtractionModule,
        MergeModule,
    ],
    providers: [
        CapabilityManager,
        {
            provide: CAPABILITY,
            useFactory: (
                insightService: InsightExtractionCapability,
                kgService: KnowledgeGraphExtractionCapability,
            ) => [kgService, insightService],
            inject: [
                InsightExtractionCapability,
                KnowledgeGraphExtractionCapability,
            ],
        },
    ],
    exports: [
        CapabilityManager,
        MergeModule,
        KnowledgeGraphExtractionModule,
    ],
})
export class CapabilitiesModule {}
