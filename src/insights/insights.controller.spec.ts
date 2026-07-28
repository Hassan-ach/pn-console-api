/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { InsightActionStatus, InsightType } from '../types/insight.types';

describe('InsightsController', () => {
    let controller: InsightsController;
    let service: jest.Mocked<InsightsService>;

    const mockInsight = {
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

    const mockListItem = {
        id: 'insight-1',
        type: InsightType.TASK,
        content: 'Review the PR',
        status: InsightActionStatus.PENDING,
        priority: 7,
        deadline: new Date('2026-08-15'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [InsightsController],
            providers: [
                {
                    provide: InsightsService,
                    useValue: {
                        findAllForUser: jest.fn(),
                        findOneForUser: jest.fn(),
                        updateActionStatus: jest.fn(),
                        updatePriority: jest.fn(),
                        findVersionsForUser: jest.fn(),
                        findVersionForUser: jest.fn(),
                        findVersionEnvelopeRefs: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get(InsightsController);
        service = module.get(InsightsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAll', () => {
        it('returns insights with priority', async () => {
            service.findAllForUser.mockResolvedValue([mockListItem]);

            const result = await controller.findAll(
                { user: { id: 'user-1' } },
                { type: InsightType.TASK, status: InsightActionStatus.PENDING },
            );

            expect(result).toEqual([mockListItem]);
            expect(service.findAllForUser).toHaveBeenCalledWith(
                'user-1',
                InsightType.TASK,
                InsightActionStatus.PENDING,
            );
        });
    });

    describe('findOne', () => {
        it('returns insight detail with priority and deadline', async () => {
            service.findOneForUser.mockResolvedValue(mockInsight);

            const result = await controller.findOne(
                { user: { id: 'user-1' } },
                'insight-1',
            );

            expect(result).toBeInstanceOf(Object);
            expect(result.priority).toBe(7);
            expect(result.deadline).toBeDefined();
            expect(service.findOneForUser).toHaveBeenCalledWith(
                'insight-1',
                'user-1',
            );
        });
    });

    describe('updatePriority', () => {
        it('calls service.updatePriority with query param priority', async () => {
            service.updatePriority.mockResolvedValue(mockInsight);

            const result = await controller.updatePriority(
                { user: { id: 'user-1' } },
                'insight-1',
                { priority: 8 },
            );

            expect(service.updatePriority).toHaveBeenCalledWith(
                'insight-1',
                'user-1',
                8,
            );
            expect(result).toBeInstanceOf(Object);
            expect(result.priority).toBe(7);
        });
    });
});
