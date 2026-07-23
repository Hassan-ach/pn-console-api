import { Injectable, NotFoundException } from '@nestjs/common';
import { JobRepository } from '../repositories/job.repository';
import { JobStatus } from '../types/job.types';

@Injectable()
export class JobService {
    constructor(private readonly jobRepository: JobRepository) {}

    async createJob(
        title: string,
        userId?: string,
        description?: string,
        progressable = false,
        progress?: number,
        message?: string,
        organizationId?: string,
        status?: JobStatus,
    ) {
        if (progressable) {
            if (!progress) {
                progress = 0;
            }
        } else {
            progress = undefined;
        }
        return this.jobRepository.create({
            userId,
            organizationId,
            title,
            message,
            progress,
            description,
            progressable,
            status,
        });
    }

    async getJob(id: string) {
        const job = await this.jobRepository.findById(id);

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        return job;
    }

    async getJobsByUser(userId: string, status?: JobStatus) {
        return this.jobRepository.findByUserId(userId, { status });
    }

    async startJob(id: string, message?: string) {
        await this.getJob(id);

        return this.jobRepository.update(id, {
            status: JobStatus.RUNNING,
            message,
            startedAt: new Date(),
        });
    }

    async updateMessage(id: string, message: string) {
        await this.getJob(id);

        return this.jobRepository.update(id, {
            message,
        });
    }

    async updateProgress(id: string, progress: number, message?: string) {
        await this.getJob(id);

        return this.jobRepository.update(id, { progress, message });
    }

    async completeJob(id: string, message?: string) {
        await this.getJob(id);

        return this.jobRepository.update(id, {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            message,
        });
    }

    async failJob(id: string, message?: string) {
        await this.getJob(id);

        return this.jobRepository.update(id, {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            message,
        });
    }
}
