import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../intelligence/capabilities/capabilities.module';
import { StoreModule } from '../intelligence/store/store.module';
import { DemoGenerationController } from './demo-generation.controller';
import { DemoPersistenceController } from './demo-persistence.controller';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DemoController } from './demo.controller';

@Module({
    imports: [
        RepositoriesModule,
        CapabilitiesModule,
        StoreModule,
    ],
    controllers: [
        DemoController,
        DemoGenerationController,
        DemoPersistenceController,
    ],
})
export class DemoModule {}
