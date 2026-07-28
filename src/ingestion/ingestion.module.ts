import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { RawDbModule } from '../prisma/raw-db/raw-db.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
    imports: [
        PluginsModule,
        RepositoriesModule,
        RawDbModule,
        IntelligenceModule,
    ],
    controllers: [],
    providers: [],
})
export class IngestionModule {}
