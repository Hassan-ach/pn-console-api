import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [LlmModule, CapabilitiesModule, StoreModule],
  exports: [StoreModule],
})
export class IntelligenceModule {}
