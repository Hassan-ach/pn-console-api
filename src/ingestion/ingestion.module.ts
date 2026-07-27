import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { StreamingModule } from './streaming/streaming.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './services/ingestion.service';

@Module({
    imports: [PluginsModule, RepositoriesModule, StreamingModule],
    controllers: [IngestionController],
    providers: [IngestionService],
})
export class IngestionModule {}
