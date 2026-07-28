import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { StreamingModule } from './streaming/streaming.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { IngestionRunnerService } from './services/ingestion-runner.service';

@Module({
    imports: [PluginsModule, RepositoriesModule, StreamingModule],
    controllers: [IngestionController],
    providers: [IngestionService, IngestionRunnerService],
    exports: [IngestionRunnerService],
})
export class IngestionModule {}
