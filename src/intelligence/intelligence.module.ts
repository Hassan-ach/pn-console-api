import { Module } from '@nestjs/common';
import { ContextModule } from './context/context.module';
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
        IntelligenceEngineService,
        EnvelopesIngestedListener,
    ],
    imports: [
        ContextModule,
        LlmModule,
        ChunkingModule,
        CapabilitiesModule,
        StoreModule,
        MergeModule,
        ToolsModule,
    ],
    exports: [ContextModule, StoreModule, IntelligenceEngineService],
})
export class IntelligenceModule {}
