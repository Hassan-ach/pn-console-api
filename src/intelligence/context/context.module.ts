import { Module } from '@nestjs/common';
import { EnterpriseContextBuilder } from './builders/enterprise-context-builder.abstract';
import { InMemoryEnterpriseContextBuilder } from './builders/in-memory-enterprise-context-builder';
import { WindowDiscoveryService } from './services/window-discovery.service';

@Module({
    providers: [
        WindowDiscoveryService,
        {
            provide: EnterpriseContextBuilder,
            useClass: InMemoryEnterpriseContextBuilder,
        },
    ],
    exports: [EnterpriseContextBuilder],
})
export class ContextModule {}
