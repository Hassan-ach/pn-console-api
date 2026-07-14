import { Module } from '@nestjs/common';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmModule } from 'src/intelligence/llm/llm.module';
import { ToolsModule } from 'src/intelligence/tools/tools.module';

@Module({
    imports: [LlmModule, ToolsModule],
    providers: [InsightExtractionCapability],
    exports: [InsightExtractionCapability],
})
export class InsightsExtractionModule {}
