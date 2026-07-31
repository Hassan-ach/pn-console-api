import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'src/common/providers/event-bus/events.registry';
import { JobService } from './job.service';
import {
    IntelligenceJobStartedEvent,
    IntelligenceJobSetTitleEvent,
    IntelligenceJobSetDescriptionEvent,
    IntelligenceJobSetProgressableEvent,
    IntelligenceJobSetProgressEvent,
    IntelligenceJobMessageEvent,
    IntelligenceJobCompletedEvent,
    IntelligenceJobFailedEvent,
} from './events/intelligence-job.events';

@Injectable()
export class JobTrackingListener {
    private readonly logger = new Logger(JobTrackingListener.name);

    constructor(private readonly jobService: JobService) {}

    @OnEvent(Events.JOB_INTELLIGENCE_STARTED)
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
            event.progressable,
            undefined,
            event.message,
            event.organizationId,
        );

        await this.jobService.startJob(job.id);

        return { jobId: job.id };
    }

    @OnEvent(Events.JOB_INTELLIGENCE_SET_TITLE)
    async handleSetTitle(event: IntelligenceJobSetTitleEvent) {
        await this.jobService.updateTitle(event.jobId, event.title);
    }

    @OnEvent(Events.JOB_INTELLIGENCE_SET_DESCRIPTION)
    async handleSetDescription(event: IntelligenceJobSetDescriptionEvent) {
        await this.jobService.updateDescription(event.jobId, event.description);
    }

    @OnEvent(Events.JOB_INTELLIGENCE_SET_PROGRESSABLE)
    async handleSetProgressable(event: IntelligenceJobSetProgressableEvent) {
        await this.jobService.updateProgressable(
            event.jobId,
            event.progressable,
        );
    }

    @OnEvent(Events.JOB_INTELLIGENCE_SET_PROGRESS)
    async handleSetProgress(event: IntelligenceJobSetProgressEvent) {
        await this.jobService.updateProgress(event.jobId, event.progress);
    }

    @OnEvent(Events.JOB_INTELLIGENCE_MESSAGE)
    async handleMessage(event: IntelligenceJobMessageEvent) {
        await this.jobService.updateMessage(event.jobId, event.message);
    }

    @OnEvent(Events.JOB_INTELLIGENCE_COMPLETED)
    async handleCompleted(event: IntelligenceJobCompletedEvent) {
        this.logger.log(`Intelligence job ${event.jobId} completed`);
        await this.jobService.completeJob(event.jobId, event.message);
    }

    @OnEvent(Events.JOB_INTELLIGENCE_FAILED)
    async handleFailed(event: IntelligenceJobFailedEvent) {
        this.logger.error(
            `Intelligence job ${event.jobId} failed: ${event.message}`,
        );
        await this.jobService.failJob(event.jobId, event.message);
    }
}
