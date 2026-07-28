import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { RawDbModule } from '../prisma/raw-db/raw-db.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StreamingModule } from './streaming/streaming.module';
import { StreamingOrchestratorService } from './streaming/streaming-orchestrator.service';
import { StreamingEventListener } from './streaming/streaming-event.listener';
import { StreamingController } from './streaming/streaming.controller';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { IngestionRunnerService } from './services/ingestion-runner.service';

@Module({
    imports: [
        PluginsModule,
        RepositoriesModule,
        RawDbModule,
        IntelligenceModule,
        StreamingModule,
    ],
    controllers: [IngestionController, StreamingController],
    providers: [
        IngestionService,
        IngestionRunnerService,
        StreamingOrchestratorService,
        StreamingEventListener,
    ],
    exports: [IngestionRunnerService],
})
export class IngestionModule {}
