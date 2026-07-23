import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { JobsController } from './jobs.controller';
import { JobService } from './job.service';

@Module({
    imports: [RepositoriesModule],
    controllers: [JobsController],
    providers: [JobService],
    exports: [JobService],
})
export class JobsModule {}
