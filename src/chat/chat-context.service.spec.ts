import { Test, TestingModule } from '@nestjs/testing';
import { ChatContextService } from './chat-context.service';
import { InsightRepository } from '../repositories/insight.repository';
import { EnvelopeRepository } from '../repositories/envelope.repository';

describe('ChatContextService', () => {
    let service: ChatContextService;
    let mockInsightRepo: jest.Mocked<InsightRepository>;
    let mockEnvelopeRepo: jest.Mocked<EnvelopeRepository>;

    beforeEach(async () => {
        mockInsightRepo = {
            findByOwnerId: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<InsightRepository>;

        mockEnvelopeRepo = {
            findRecent: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<EnvelopeRepository>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatContextService,
                { provide: InsightRepository, useValue: mockInsightRepo },
                { provide: EnvelopeRepository, useValue: mockEnvelopeRepo },
            ],
        }).compile();

        service = module.get<ChatContextService>(ChatContextService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('buildContext', () => {
        it('returns formatted insights and messages sections', async () => {
            mockInsightRepo.findByOwnerId.mockResolvedValue([
                {
                    id: '1',
                    type: 'TASK',
                    content: 'Review PR',
                    status: 'PENDING',
                },
            ]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([
                {
                    envolopId: 'env-1',
                    sourcePlugin: 'telegram',
                    occurredAt: new Date('2026-07-27T10:00:00Z'),
                    content: 'Hello world',
                },
            ]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('## User Insights');
            expect(result).toContain('## Recent Ingested Messages');
            expect(result).toContain('- **TASK**: Review PR');
            expect(result).toContain('- **telegram**');
            expect(result).toContain('Hello world');
        });

        it('handles empty insights gracefully', async () => {
            mockInsightRepo.findByOwnerId.mockResolvedValue([]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([
                {
                    envolopId: 'env-2',
                    sourcePlugin: 'telegram',
                    occurredAt: new Date('2026-07-27T10:00:00Z'),
                    content: 'msg',
                },
            ]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('No insights on file');
            expect(result).not.toContain('## User Insights\n\n-');
        });

        it('handles empty envelopes gracefully', async () => {
            mockInsightRepo.findByOwnerId.mockResolvedValue([
                { id: '1', type: 'INFO', content: 'Update', status: 'PENDING' },
            ]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('No recent messages');
            expect(result).not.toContain('## Recent Ingested Messages\n\n-');
        });

        it('formats insights with type and content', async () => {
            mockInsightRepo.findByOwnerId.mockResolvedValue([
                {
                    id: '1',
                    type: 'URGENCY',
                    content: 'Server down',
                    status: 'PENDING',
                },
                {
                    id: '2',
                    type: 'DECISION',
                    content: 'Approve budget',
                    status: 'PENDING',
                },
            ]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('- **URGENCY**: Server down');
            expect(result).toContain('- **DECISION**: Approve budget');
        });

        it('formats messages with plugin and timestamp', async () => {
            mockInsightRepo.findByOwnerId.mockResolvedValue([]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([
                {
                    envolopId: 'env-3',
                    sourcePlugin: 'telegram',
                    occurredAt: new Date('2026-07-27T12:30:00Z'),
                    content: 'Meeting at 3pm',
                },
            ]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('- **telegram**');
            expect(result).toContain('Meeting at 3pm');
            expect(result).toContain('2026-07-27T12:30:00.000Z');
        });

        it('calls both repositories in parallel', async () => {
            await service.buildContext('user-1');

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockInsightRepo.findByOwnerId).toHaveBeenCalledWith(
                'user-1',
            );
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(mockEnvelopeRepo.findRecent).toHaveBeenCalledWith(10);
        });
    });
});
