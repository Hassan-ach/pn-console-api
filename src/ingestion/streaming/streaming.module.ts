import { Module } from '@nestjs/common';
import { PluginsModule } from '../plugins/plugins.module';
import { IngestionModule } from '../ingestion.module';
import { IntelligenceModule } from '../../intelligence/intelligence.module';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { RawDbModule } from '../../prisma/raw-db/raw-db.module';
import { StreamingResumeService } from './streaming-resume.service';
// import { StreamingOrchestratorService } from './streaming-orchestrator.service';
// import { StreamingEventListener } from './streaming-event.listener';
// import { StreamingController } from './streaming.controller';

@Module({
    imports: [
        PluginsModule,
        IngestionModule,
        IntelligenceModule,
        RepositoriesModule,
        RawDbModule,
    ],
    // controllers: [StreamingController],
    providers: [StreamingResumeService],
    exports: [StreamingResumeService],
})
export class StreamingModule {}
