import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { RawDbModule } from '../prisma/raw-db/raw-db.module';
import { StreamingModule } from './streaming/streaming.module';
import { StreamingOrchestratorService } from './streaming/streaming-orchestrator.service';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { IngestionRunnerService } from './services/ingestion-runner.service';

@Module({
    imports: [PluginsModule, RepositoriesModule, RawDbModule, StreamingModule],
    controllers: [IngestionController],
    providers: [
        IngestionService,
        IngestionRunnerService,
        StreamingOrchestratorService,
    ],
    exports: [IngestionRunnerService],
})
export class IngestionModule {}
