/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InsightActionRepository } from '../repositories/insight-action.repository';
import { InsightRepository } from '../repositories/insight.repository';
import {
    Insight,
    InsightActionStatus,
    InsightType,
} from '../types/insight.types';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
    let service: InsightsService;
    let insightRepository: jest.Mocked<InsightRepository>;
    let insightActionRepository: jest.Mocked<InsightActionRepository>;

    const mockInsight: Insight = {
        id: 'insight-1',
        organizationId: 'org-1',
        type: InsightType.TASK,
        content: 'Review the PR',
        owners: ['user-1'],
        envolopsRef: ['env-1'],
        broadcasted: false,
        version: 1,
        latestVersionId: 'version-1',
        createdAt: new Date('2026-07-01'),
        sourcePlugin: 'slack',
        status: InsightActionStatus.PENDING,
        priority: 7,
        deadline: new Date('2026-08-15'),
    };

    const mockFindByOwnerResult = {
        id: 'insight-1',
        type: InsightType.TASK as const,
        content: 'Review the PR',
        status: InsightActionStatus.PENDING as const,
        priority: 7,
        deadline: new Date('2026-08-15'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightsService,
                {
                    provide: InsightRepository,
                    useValue: {
                        findById: jest.fn(),
                        findByOwnerId: jest.fn(),
                        getLatestVersionId: jest.fn(),
                        findVersionsByInsightId: jest.fn(),
                        findVersionById: jest.fn(),
                        findVersionEnvelopeRefs: jest.fn(),
                    },
                },
                {
                    provide: InsightActionRepository,
                    useValue: {
                        upsert: jest.fn(),
                        upsertPriority: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(InsightsService);
        insightRepository = module.get(InsightRepository);
        insightActionRepository = module.get(InsightActionRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAllForUser', () => {
        it('returns results with priority and deadline', async () => {
            insightRepository.findByOwnerId.mockResolvedValue([
                mockFindByOwnerResult,
            ]);

            const results = await service.findAllForUser('user-1');

            expect(results).toHaveLength(1);
            expect(results[0].priority).toBe(7);
            expect(results[0].deadline).toEqual(mockFindByOwnerResult.deadline);
        });

        it('passes type and status filters to the repository', async () => {
            insightRepository.findByOwnerId.mockResolvedValue([]);

            await service.findAllForUser(
                'user-1',
                InsightType.TASK,
                InsightActionStatus.PENDING,
            );

            expect(insightRepository.findByOwnerId).toHaveBeenCalledWith(
                'user-1',
                InsightType.TASK,
                InsightActionStatus.PENDING,
            );
        });
    });

    describe('findOneForUser', () => {
        it('returns insight with priority and deadline', async () => {
            insightRepository.findById.mockResolvedValue(mockInsight);

            const result = await service.findOneForUser('insight-1', 'user-1');

            expect(result).toEqual(mockInsight);
            expect(result.priority).toBe(7);
            expect(result.deadline).toEqual(mockInsight.deadline);
        });

        it('throws NotFoundException when insight not found', async () => {
            insightRepository.findById.mockResolvedValue(null);

            await expect(
                service.findOneForUser('nonexistent', 'user-1'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updatePriority', () => {
        it('upserts priority and returns updated insight', async () => {
            insightRepository.findById
                .mockResolvedValueOnce(mockInsight)
                .mockResolvedValueOnce({ ...mockInsight, priority: 9 });
            insightRepository.getLatestVersionId.mockResolvedValue('version-1');
            insightActionRepository.upsertPriority.mockResolvedValue(
                {} as never,
            );

            const result = await service.updatePriority(
                'insight-1',
                'user-1',
                9,
            );

            expect(insightRepository.findById).toHaveBeenNthCalledWith(
                1,
                'insight-1',
                'user-1',
            );
            expect(insightRepository.getLatestVersionId).toHaveBeenCalledWith(
                'insight-1',
            );
            expect(insightActionRepository.upsertPriority).toHaveBeenCalledWith(
                'version-1',
                'user-1',
                9,
            );
            expect(insightRepository.findById).toHaveBeenNthCalledWith(
                2,
                'insight-1',
                'user-1',
            );
            expect(result.priority).toBe(9);
        });

        it('throws NotFoundException when insight not found', async () => {
            insightRepository.findById.mockResolvedValue(null);

            await expect(
                service.updatePriority('nonexistent', 'user-1', 5),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when latest version not found', async () => {
            insightRepository.findById.mockResolvedValue(mockInsight);
            insightRepository.getLatestVersionId.mockResolvedValue(null);

            await expect(
                service.updatePriority('insight-1', 'user-1', 5),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('findVersionsForUser', () => {
        const mockVersions = [
            {
                id: 'version-1',
                version: 1,
                type: InsightType.TASK as const,
                content: 'Review the PR',
                status: InsightActionStatus.PENDING as const,
                priority: 7,
                deadline: new Date('2026-08-15'),
            },
        ];

        it('returns versions with priority and deadline', async () => {
            insightRepository.findVersionsByInsightId.mockResolvedValue(
                mockVersions,
            );

            const result = await service.findVersionsForUser(
                'insight-1',
                'user-1',
            );

            expect(result).toEqual(mockVersions);
            expect(result[0].priority).toBe(7);
            expect(result[0].deadline).toBeDefined();
        });

        it('throws NotFoundException when insight not found', async () => {
            insightRepository.findVersionsByInsightId.mockResolvedValue(null);

            await expect(
                service.findVersionsForUser('nonexistent', 'user-1'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('findVersionForUser', () => {
        const mockVersion = {
            id: 'version-1',
            organizationId: 'org-1',
            type: InsightType.TASK as const,
            content: 'Review the PR',
            envolopsRef: ['env-1'],
            broadcasted: false,
            version: 1,
            latestVersionId: 'version-1',
            createdAt: new Date('2026-07-01'),
            sourcePlugin: 'slack',
            status: InsightActionStatus.PENDING as const,
            priority: 7,
            deadline: new Date('2026-08-15'),
        };

        it('returns version with priority and deadline', async () => {
            insightRepository.findVersionById.mockResolvedValue(mockVersion);

            const result = await service.findVersionForUser(
                'insight-1',
                'version-1',
                'user-1',
            );

            expect(result).toEqual(mockVersion);
            expect(result.priority).toBe(7);
            expect(result.deadline).toBeDefined();
        });

        it('throws NotFoundException when version not found', async () => {
            insightRepository.findVersionById.mockResolvedValue(null);

            await expect(
                service.findVersionForUser(
                    'insight-1',
                    'nonexistent',
                    'user-1',
                ),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
