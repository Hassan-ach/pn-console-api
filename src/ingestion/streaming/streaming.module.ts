import { Module } from '@nestjs/common';
import { RawDbModule } from '../../prisma/raw-db/raw-db.module';
import { StreamingResumeService } from './streaming-resume.service';
// import { StreamingOrchestratorService } from './streaming-orchestrator.service';
// import { StreamingEventListener } from './streaming-event.listener';
// import { StreamingController } from './streaming.controller';

@Module({
    imports: [RawDbModule],
    // controllers: [StreamingController],
    providers: [StreamingResumeService],
    exports: [StreamingResumeService],
})
export class StreamingModule {}
