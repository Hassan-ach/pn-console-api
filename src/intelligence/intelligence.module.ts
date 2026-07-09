import { Module } from '@nestjs/common';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { InMemoryEnterpriseContextBuilder } from './context/in-memory-enterprise-context-builder';
import { LlmModule } from './llm/llm.module';
import { ChunkingModule } from './chunking/chunking.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { StoreModule } from './store/store.module';
import { IntelligenceEngineService } from './intelligence-engine.service';

@Module({
    providers: [
        {
            provide: EnterpriseContextBuilder,
            useClass: InMemoryEnterpriseContextBuilder,
        },
        IntelligenceEngineService,
    ],
    imports: [LlmModule, ChunkingModule, CapabilitiesModule, StoreModule],
    exports: [EnterpriseContextBuilder, StoreModule, IntelligenceEngineService],
})
export class IntelligenceModule {}
