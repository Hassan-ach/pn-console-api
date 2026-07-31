import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { ToolsModule } from '../../tools/tools.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { GraphModule } from 'src/graph/graph.module';
import { InsightExtractionCapabilityV2 } from './insight-extraction-v2.capability';

@Module({
    imports: [LlmModule, ToolsModule, RepositoriesModule, GraphModule],
    providers: [InsightExtractionCapabilityV2],
    exports: [InsightExtractionCapabilityV2],
})
export class InsightsExtractionV2Module {}
