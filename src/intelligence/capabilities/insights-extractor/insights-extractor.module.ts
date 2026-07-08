import { Module } from '@nestjs/common';
import { InsightExtractorService } from './insights-extractor.service';
import { LlmModule } from 'src/intelligence/llm/llm.module';
@Module({
  imports: [LlmModule],
  providers: [InsightExtractorService]
})
export class InsightsExtractorModule {}
