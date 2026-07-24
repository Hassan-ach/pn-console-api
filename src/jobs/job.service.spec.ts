/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobService } from './job.service';
import { JobRepository } from '../repositories/job.repository';
import { JobStatus } from '../types/job.types';

describe('JobService', () => {
    let service: JobService;
    let repository: jest.Mocked<JobRepository>;

    const mockJob = {
        id: 'job-1',
        userId: 'user-1',
        organizationId: 'org-1',
        title: 'Data Ingestion',
        description: 'Ingesting Telegram messages',
        progressable: true,
        progress: 0,
        message: null,
        status: JobStatus.PENDING,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JobService,
                {
                    provide: JobRepository,
                    useValue: {
                        create: jest.fn(),
                        findById: jest.fn(),
                        findByUserId: jest.fn(),
                        update: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(JobService);
        repository = module.get(JobRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createJob', () => {
        it('creates a job with all params', async () => {
            repository.create.mockResolvedValue(mockJob);

            const result = await service.createJob(
                'Data Ingestion',
                'user-1',
                'Ingesting Telegram messages',
                true,
                0,
                'Starting',
                'org-1',
                JobStatus.PENDING,
            );

            expect(repository.create).toHaveBeenCalledWith({
                userId: 'user-1',
                organizationId: 'org-1',
                title: 'Data Ingestion',
                message: 'Starting',
                progress: 0,
                description: 'Ingesting Telegram messages',
                progressable: true,
                status: JobStatus.PENDING,
            });
            expect(result).toEqual(mockJob);
        });

        it('creates a job with only title', async () => {
            const minimalJob = {
                ...mockJob,
                progressable: false,
                progress: null,
            };
            repository.create.mockResolvedValue(minimalJob);

            await service.createJob('Data Ingestion');

            expect(repository.create).toHaveBeenCalledWith({
                userId: undefined,
                organizationId: undefined,
                title: 'Data Ingestion',
                message: undefined,
                progress: undefined,
                description: undefined,
                progressable: false,
                status: undefined,
            });
        });

        it('defaults progress to 0 when progressable is true and no progress given', async () => {
            repository.create.mockResolvedValue(mockJob);

            await service.createJob('Job', 'user-1', undefined, true);

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ progress: 0 }),
            );
        });

        it('sets progress to undefined when progressable is false', async () => {
            repository.create.mockResolvedValue(mockJob);

            await service.createJob('Job', 'user-1', undefined, false, 50);

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ progress: undefined }),
            );
        });

        it('passes status to repository', async () => {
            repository.create.mockResolvedValue(mockJob);

            await service.createJob(
                'Job',
                undefined,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                JobStatus.RUNNING,
            );

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ status: JobStatus.RUNNING }),
            );
        });

        it('passes message to repository', async () => {
            repository.create.mockResolvedValue(mockJob);

            await service.createJob(
                'Job',
                undefined,
                undefined,
                false,
                undefined,
                'Initial message',
            );

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Initial message' }),
            );
        });
    });

    describe('getJob', () => {
        it('returns the job when found', async () => {
            repository.findById.mockResolvedValue(mockJob);

            const result = await service.getJob('job-1');

            expect(result).toEqual(mockJob);
            expect(repository.findById).toHaveBeenCalledWith('job-1');
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.getJob('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getJobsByUser', () => {
        it('returns jobs for user', async () => {
            repository.findByUserId.mockResolvedValue([mockJob]);

            const result = await service.getJobsByUser('user-1');

            expect(result).toEqual([mockJob]);
            expect(repository.findByUserId).toHaveBeenCalledWith('user-1', {
                status: undefined,
            });
        });

        it('passes status filter to repository', async () => {
            repository.findByUserId.mockResolvedValue([mockJob]);

            await service.getJobsByUser('user-1', JobStatus.RUNNING);

            expect(repository.findByUserId).toHaveBeenCalledWith('user-1', {
                status: JobStatus.RUNNING,
            });
        });
    });

    describe('startJob', () => {
        it('calls update with RUNNING status and startedAt', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue({
                ...mockJob,
                status: JobStatus.RUNNING,
            });

            const result = await service.startJob('job-1');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                status: JobStatus.RUNNING,
                message: undefined,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                startedAt: expect.any(Date),
            });
            expect(result.status).toBe(JobStatus.RUNNING);
        });

        it('passes message to repository', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue(mockJob);

            await service.startJob('job-1', 'Starting ingestion');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                status: JobStatus.RUNNING,
                message: 'Starting ingestion',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                startedAt: expect.any(Date),
            });
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.startJob('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('updateMessage', () => {
        it('calls update with message', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue({
                ...mockJob,
                message: 'Processing batch 2',
            });

            await service.updateMessage('job-1', 'Processing batch 2');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                message: 'Processing batch 2',
            });
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(
                service.updateMessage('nonexistent', 'msg'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateProgress', () => {
        it('calls update with progress and message', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue({
                ...mockJob,
                progress: 50,
            });

            await service.updateProgress('job-1', 50, 'Halfway done');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                progress: 50,
                message: 'Halfway done',
            });
        });

        it('calls update with progress only', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue(mockJob);

            await service.updateProgress('job-1', 75);

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                progress: 75,
                message: undefined,
            });
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(
                service.updateProgress('nonexistent', 50),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('completeJob', () => {
        it('calls update with COMPLETED status, completedAt, and message', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue({
                ...mockJob,
                status: JobStatus.COMPLETED,
                completedAt: new Date(),
            });

            const result = await service.completeJob('job-1', 'Done');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                status: JobStatus.COMPLETED,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                completedAt: expect.any(Date),
                message: 'Done',
            });
            expect(result.status).toBe(JobStatus.COMPLETED);
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.completeJob('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('failJob', () => {
        it('calls update with FAILED status, completedAt, and message', async () => {
            repository.findById.mockResolvedValue(mockJob);
            repository.update.mockResolvedValue({
                ...mockJob,
                status: JobStatus.FAILED,
                completedAt: new Date(),
            });

            const result = await service.failJob('job-1', 'LLM timeout');

            expect(repository.update).toHaveBeenCalledWith('job-1', {
                status: JobStatus.FAILED,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                completedAt: expect.any(Date),
                message: 'LLM timeout',
            });
            expect(result.status).toBe(JobStatus.FAILED);
        });

        it('throws NotFoundException when job not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.failJob('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
