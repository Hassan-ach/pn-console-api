import { Module } from '@nestjs/common'
import { LlmFactoryService } from './llm-factory.service'

@Module({
  providers: [LlmFactoryService],
  exports: [LlmFactoryService],
})
export class LlmModule {}
