import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JobService } from './job.service';
import {
    IntelligenceJobStartedEvent,
    IntelligenceJobMessageEvent,
    IntelligenceJobCompletedEvent,
    IntelligenceJobFailedEvent,
} from './events/intelligence-job.events';

@Injectable()
export class JobTrackingListener {
    private readonly logger = new Logger(JobTrackingListener.name);

    constructor(private readonly jobService: JobService) {}

    @OnEvent('job.intelligence.started')
    async handleStarted(
        event: IntelligenceJobStartedEvent,
    ): Promise<{ jobId: string }> {
        this.logger.log(
            `Creating intelligence job for org=${event.organizationId}, user=${event.userId}`,
        );

        const job = await this.jobService.createJob(
            event.title,
            event.userId,
            event.description,
            false,
            undefined,
            event.message,
            event.organizationId,
        );

        await this.jobService.startJob(job.id);

        return { jobId: job.id };
    }

    @OnEvent('job.intelligence.message')
    async handleMessage(event: IntelligenceJobMessageEvent) {
        await this.jobService.updateMessage(event.jobId, event.message);
    }

    @OnEvent('job.intelligence.completed')
    async handleCompleted(event: IntelligenceJobCompletedEvent) {
        this.logger.log(`Intelligence job ${event.jobId} completed`);
        await this.jobService.completeJob(event.jobId, event.message);
    }

    @OnEvent('job.intelligence.failed')
    async handleFailed(event: IntelligenceJobFailedEvent) {
        this.logger.error(
            `Intelligence job ${event.jobId} failed: ${event.message}`,
        );
        await this.jobService.failJob(event.jobId, event.message);
    }
}
