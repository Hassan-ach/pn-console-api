import { Test, TestingModule } from '@nestjs/testing';
import { ChatContextService } from './chat-context.service';
import { InsightRepository } from 'src/repositories/insight.repository';
import { EnvelopeRepository } from 'src/repositories/envelope.repository';

describe('ChatContextService', () => {
    let service: ChatContextService;

    const mockInsightRepo = {
        findByOwnerId: jest.fn(),
    };

    const mockEnvelopeRepo = {
        findRecent: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatContextService,
                { provide: InsightRepository, useValue: mockInsightRepo },
                { provide: EnvelopeRepository, useValue: mockEnvelopeRepo },
            ],
        }).compile();

        service = module.get<ChatContextService>(ChatContextService);
        jest.clearAllMocks();
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
                    priority: 1,
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
                {
                    id: '1',
                    type: 'INFO',
                    content: 'Update',
                    status: 'PENDING',
                    priority: 1,
                },
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
                    priority: 1,
                },
                {
                    id: '2',
                    type: 'DECISION',
                    content: 'Approve budget',
                    status: 'PENDING',
                    priority: 1,
                },
            ]);
            mockEnvelopeRepo.findRecent.mockResolvedValue([]);

            const result = await service.buildContext('user-1');

            expect(result).toContain('- **URGENCY**: Server down');
            expect(result).toContain('- **DECISION**: Approve budget');
        });
    });
});
