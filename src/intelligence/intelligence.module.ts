import { Module } from '@nestjs/common';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { InMemoryEnterpriseContextBuilder } from './context/in-memory-enterprise-context-builder';
import { LlmModule } from './llm/llm.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { StoreModule } from './store/store.module';
import { MergeModule } from './merge/merge.module';

@Module({
    providers: [
        {
            provide: EnterpriseContextBuilder,
            useClass: InMemoryEnterpriseContextBuilder,
        },
    ],
    imports: [LlmModule, CapabilitiesModule, StoreModule, MergeModule],
    exports: [EnterpriseContextBuilder, StoreModule],
})
export class IntelligenceModule {}
