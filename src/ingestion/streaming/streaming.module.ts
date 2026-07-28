import { Module } from '@nestjs/common';
import { PluginsModule } from '../plugins/plugins.module';
import { IngestionModule } from '../ingestion.module';
import { IntelligenceModule } from '../../intelligence/intelligence.module';
import { RepositoriesModule } from '../../repositories/repositories.module';
// import { StreamingOrchestratorService } from './streaming-orchestrator.service';
// import { StreamingResumeService } from './streaming-resume.service';
// import { StreamingEventListener } from './streaming-event.listener';
// import { StreamingController } from './streaming.controller';

@Module({
    imports: [
        PluginsModule,
        IngestionModule,
        IntelligenceModule,
        RepositoriesModule,
    ],
    // controllers: [StreamingController],
    // providers: [
    //     StreamingOrchestratorService,
    //     StreamingResumeService,
    //     StreamingEventListener,
    // ],
})
export class StreamingModule {}
