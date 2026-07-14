import { Module } from '@nestjs/common';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { InMemoryEnterpriseContextBuilder } from './context/in-memory-enterprise-context-builder';
import { LlmModule } from './llm/llm.module';
import { ChunkingModule } from './chunking/chunking.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { StoreModule } from './store/store.module';
import { MergeModule } from './merge/merge.module';
import { ToolsModule } from './tools/tools.module';
import { IntelligenceEngineService } from './intelligence-engine.service';
import { EnvelopesIngestedListener } from './triggers/envelopes-ingested.listener';

@Module({
    providers: [
        {
            provide: EnterpriseContextBuilder,
            useClass: InMemoryEnterpriseContextBuilder,
        },
        IntelligenceEngineService,
        EnvelopesIngestedListener,
    ],
    imports: [
        LlmModule,
        ChunkingModule,
        CapabilitiesModule,
        StoreModule,
        MergeModule,
        ToolsModule,
    ],
    exports: [EnterpriseContextBuilder, StoreModule, IntelligenceEngineService],
})
export class IntelligenceModule {}
