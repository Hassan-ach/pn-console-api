import { Module } from '@nestjs/common'
import { LlmModule } from '../llm/llm.module'
import { InsightExtractionService } from './insight-extraction.service'

@Module({
  imports: [LlmModule],
  providers: [InsightExtractionService],
  exports: [InsightExtractionService],
})
export class InsightExtractionModule {}
