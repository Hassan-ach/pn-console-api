import { Module } from '@nestjs/common';
import { InsightsExtractionModule } from './insights-extraction/insights-extraction.module';
import { InsightExtractionCapability } from './insights-extraction/insight-extraction.capability';
import { KnowledgeGraphExtractionModule } from './knowledge-graph-extraction/knowledge-graph-extraction.module';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction/knowledge-graph-extraction.capability';
import { InsightsExtractionV2Module } from './insights-extraction-v2/insights-extraction-v2.module';
import { InsightExtractionCapabilityV2 } from './insights-extraction-v2/insight-extraction-v2.capability';
import { SuggestionsCapabilityModule } from './suggestions/suggestions.capability.module';
import { SuggestionsCapability } from './suggestions/suggestions.capability';
import { MergeModule } from '../merge/merge.module';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';

@Module({
    imports: [
        InsightsExtractionModule,
        KnowledgeGraphExtractionModule,
        InsightsExtractionV2Module,
        SuggestionsCapabilityModule,
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
                suggestionsService: SuggestionsCapability,
            ) => [kgService, insightService, insightV2Service, suggestionsService],
            inject: [
                InsightExtractionCapability,
                KnowledgeGraphExtractionCapability,
                InsightExtractionCapabilityV2,
                SuggestionsCapability,
            ],
        },
    ],
    exports: [
        CapabilityManager,
        MergeModule,
        KnowledgeGraphExtractionModule,
        InsightsExtractionV2Module,
        SuggestionsCapabilityModule,
    ],
})
export class CapabilitiesModule {}
