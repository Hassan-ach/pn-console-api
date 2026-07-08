import { Module } from '@nestjs/common';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { InMemoryEnterpriseContextBuilder } from './context/in-memory-enterprise-context-builder';

@Module({
    providers: [
        {
            provide: EnterpriseContextBuilder,
            useClass: InMemoryEnterpriseContextBuilder,
        },
    ],
    exports: [EnterpriseContextBuilder],
})
export class IntelligenceModule {}
