import { Module } from '@nestjs/common';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmModule } from 'src/intelligence/llm/llm.module';

@Module({
    imports: [LlmModule],
    providers: [InsightExtractionCapability],
    exports: [InsightExtractionCapability],
})
export class InsightsExtractionModule {}
