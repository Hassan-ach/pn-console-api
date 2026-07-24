import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { JobsController } from './jobs.controller';
import { JobService } from './job.service';
import { JobTrackingListener } from './job-tracking.listener';

@Module({
    imports: [RepositoriesModule],
    controllers: [JobsController],
    providers: [JobService, JobTrackingListener],
    exports: [JobService],
})
export class JobsModule {}
