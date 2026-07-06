import { Module } from '@nestjs/common'
import { LlmFactoryService } from './llm-factory.service'
import { LlmService } from './llm.service';

@Module({
  providers: [LlmFactoryService, LlmService],
  exports: [LlmFactoryService],
})
export class LlmModule {}
