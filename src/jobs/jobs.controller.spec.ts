/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobService } from './job.service';
import { JobStatus } from '../types/job.types';

describe('JobsController', () => {
    let controller: JobsController;
    let service: jest.Mocked<JobService>;

    const mockJob = {
        id: 'job-1',
        userId: 'user-1',
        organizationId: 'org-1',
        title: 'Data Ingestion',
        description: 'Ingesting Telegram messages',
        progressable: true,
        progress: 50,
        message: 'Processing batch 2',
        status: JobStatus.RUNNING,
        startedAt: new Date('2026-01-01'),
        completedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [JobsController],
            providers: [
                {
                    provide: JobService,
                    useValue: {
                        getJobsByUser: jest.fn(),
                        getJob: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get(JobsController);
        service = module.get(JobService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAll', () => {
        it('returns jobs for the authenticated user', async () => {
            service.getJobsByUser.mockResolvedValue([mockJob]);

            const result = await controller.findAll(
                { user: { id: 'user-1' } },
                {},
            );

            expect(service.getJobsByUser).toHaveBeenCalledWith(
                'user-1',
                undefined,
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('job-1');
        });

        it('passes status filter to service', async () => {
            service.getJobsByUser.mockResolvedValue([mockJob]);

            await controller.findAll(
                { user: { id: 'user-1' } },
                {
                    status: JobStatus.RUNNING,
                },
            );

            expect(service.getJobsByUser).toHaveBeenCalledWith(
                'user-1',
                JobStatus.RUNNING,
            );
        });

        it('returns empty array when no jobs', async () => {
            service.getJobsByUser.mockResolvedValue([]);

            const result = await controller.findAll(
                { user: { id: 'user-1' } },
                {},
            );

            expect(result).toEqual([]);
        });
    });

    describe('findOne', () => {
        it('returns job by ID', async () => {
            service.getJob.mockResolvedValue(mockJob);

            const result = await controller.findOne('job-1');

            expect(service.getJob).toHaveBeenCalledWith('job-1');
            expect(result.id).toBe('job-1');
        });

        it('throws NotFoundException when job not found', async () => {
            service.getJob.mockRejectedValue(
                new NotFoundException('Job not found'),
            );

            await expect(controller.findOne('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
