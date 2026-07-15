import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../intelligence/capabilities/capabilities.module';
import { StoreModule } from '../intelligence/store/store.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { DemoIntelligenceController } from './demo-intelligence.controller';
import { DemoGenerationController } from './demo-generation.controller';
import { DemoPersistenceController } from './demo-persistence.controller';
import { EnvelopeModule } from '../envelope/envelope.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DemoController } from './demo.controller';

@Module({
    imports: [
        EnvelopeModule,
        RepositoriesModule,
        CapabilitiesModule,
        StoreModule,
        IntelligenceModule,
    ],
    controllers: [
        DemoController,
        DemoGenerationController,
        DemoPersistenceController,
    ],
})
export class DemoModule {}
