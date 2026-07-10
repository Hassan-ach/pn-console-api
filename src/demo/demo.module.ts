import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../intelligence/capabilities/capabilities.module';
import { StoreModule } from '../intelligence/store/store.module';
import { DemoGenerationController } from './demo-generation.controller';
import { DemoPersistenceController } from './demo-persistence.controller';

@Module({
    imports: [CapabilitiesModule, StoreModule],
    controllers: [DemoGenerationController, DemoPersistenceController],
})
export class DemoModule {}
