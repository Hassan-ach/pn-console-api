import { Module } from '@nestjs/common';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmModule } from 'src/intelligence/llm/llm.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';

@Module({
    imports: [LlmModule, RepositoriesModule],
    providers: [InsightExtractionCapability],
    exports: [InsightExtractionCapability],
})
export class InsightsExtractionModule {}
