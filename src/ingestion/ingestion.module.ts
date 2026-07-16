import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
    imports: [PluginsModule, RepositoriesModule],
    controllers: [IngestionController],
    providers: [IngestionService],
})
export class IngestionModule {}
