import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { JobStatus } from 'src/types/job.types';

export interface JobRecord {
    id: string;
    userId: string | null;
    organizationId: string | null;
    title: string;
    description: string | null;
    progressable: boolean;
    progress: number | null;
    message: string | null;
    status: JobStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class JobRepository {
    constructor(private readonly appDb: AppDbService) {}

    async create(data: {
        userId?: string;
        organizationId?: string;
        title: string;
        description?: string;
        progressable?: boolean;
        status?: JobStatus;
        message?: string;
        progress?: number; 
    }): Promise<JobRecord> {
        return this.appDb.job.create({ data });
    }

    async findById(id: string): Promise<JobRecord | null> {
        return this.appDb.job.findUnique({
            where: { id },
        });
    }

    async findByUserId(
        userId: string,
        options?: { status?: JobStatus; limit?: number },
    ): Promise<JobRecord[]> {
        return this.appDb.job.findMany({
            where: {
                userId,
                ...(options?.status ? { status: options.status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: options?.limit ?? 50,
        });
    }

    async update(
        id: string,
        data: {
            status?: JobStatus;
            progress?: number;
            message?: string;
            startedAt?: Date;
            completedAt?: Date;
        },
    ): Promise<JobRecord> {
        return this.appDb.job.update({
            where: { id },
            data,
        });
    }
}
