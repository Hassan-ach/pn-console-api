import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatContextService } from './chat-context.service';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { EmbeddingService } from 'src/intelligence/embeddings/embedding.service';

describe('ChatContextService', () => {
    let service: ChatContextService;

    const mockEmbeddingService = {
        embed: jest.fn(),
    };

    const mockEmbeddingRepo = {
        searchSimilar: jest.fn(),
        findByFilters: jest.fn().mockResolvedValue([]),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatContextService,
                { provide: EmbeddingService, useValue: mockEmbeddingService },
                { provide: EmbeddingRepository, useValue: mockEmbeddingRepo },
            ],
        }).compile();

        service = module.get<ChatContextService>(ChatContextService);
        jest.clearAllMocks();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('buildContext', () => {
        it('returns context section when userMessage is provided', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'Review PR',
                    type: 'TASK',
                    status: 'PENDING',
                    priority: 1,
                    sourcePlugin: 'telegram',
                    groupId: 'work-chat',
                    channelId: null,
                    topicId: null,
                    deadline: null,
                    similarity: 0.85,
                },
            ]);

            const result = await service.buildContext(
                'user-1',
                'what are my tasks?',
            );

            expect(result).toContain('## Current Date');
            expect(result).toContain('## Relevant Insights');
            expect(result).toContain('telegram/work-chat');
        });

        it('returns empty string when userMessage is empty', async () => {
            const result = await service.buildContext('user-1');

            expect(result).toBe('');
        });

        it('returns empty string when no similar results found on both passes', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            // Both primary and fallback return empty
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([]);

            const result = await service.buildContext('user-1', 'something');

            expect(result).toBe('');
        });

        it('uses fallback threshold when primary returns no results', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            // First call (primary 0.65): no results. Second call (fallback 0.45): results.
            mockEmbeddingRepo.searchSimilar
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    {
                        insightVersionId: 'v1',
                        insightId: 'i1',
                        content: 'Low match insight',
                        type: 'INFO',
                        status: null,
                        priority: null,
                        sourcePlugin: null,
                        groupId: null,
                        channelId: null,
                        topicId: null,
                        deadline: null,
                        similarity: 0.5,
                    },
                ]);

            const result = await service.buildContext('user-1', 'obscure');

            expect(result).toContain('Low match insight');
            expect(mockEmbeddingRepo.searchSimilar).toHaveBeenCalledTimes(2);
            // Second call should use fallback threshold 0.45
            expect(mockEmbeddingRepo.searchSimilar).toHaveBeenNthCalledWith(
                2,
                [0.1, 0.2, 0.3],
                5,
                'user-1',
                0.45,
            );
        });

        it('formats insight with type, status, priority, source and relevance', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'Server down',
                    type: 'URGENCY',
                    status: 'PENDING',
                    priority: 8,
                    sourcePlugin: 'telegram',
                    groupId: 'team-a',
                    channelId: null,
                    topicId: null,
                    deadline: null,
                    similarity: 0.92,
                },
                {
                    insightVersionId: 'v2',
                    insightId: 'i2',
                    content: 'Approve budget',
                    type: 'DECISION',
                    status: 'DECIDED',
                    priority: null,
                    sourcePlugin: 'discord',
                    groupId: null,
                    channelId: 'finance',
                    topicId: null,
                    deadline: null,
                    similarity: 0.78,
                },
            ]);

            const result = await service.buildContext('user-1', 'urgent items');

            expect(result).toContain(
                '- **URGENCY** [PENDING] (priority: 8/10) from telegram/team-a: Server down',
            );
            expect(result).toContain(
                '- **DECISION** [DECIDED] from discord/finance: Approve budget',
            );
        });

        it('formats overdue deadline correctly', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 3);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'Submit report',
                    type: 'TASK',
                    status: 'PENDING',
                    priority: 7,
                    sourcePlugin: 'telegram',
                    groupId: null,
                    channelId: null,
                    topicId: null,
                    deadline: pastDate,
                    similarity: 0.88,
                },
            ]);

            const result = await service.buildContext('user-1', 'deadline');

            expect(result).toContain('OVERDUE');
        });

        it('formats future deadline correctly', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'Prepare slides',
                    type: 'TASK',
                    status: 'PENDING',
                    priority: 5,
                    sourcePlugin: 'slack',
                    groupId: null,
                    channelId: null,
                    topicId: null,
                    deadline: futureDate,
                    similarity: 0.80,
                },
            ]);

            const result = await service.buildContext('user-1', 'upcoming');

            expect(result).toContain('in 5 day(s)');
        });

        it('uses topicId in source when channelId is absent', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'Topic discussion',
                    type: 'INFO',
                    status: null,
                    priority: null,
                    sourcePlugin: 'slack',
                    groupId: null,
                    channelId: null,
                    topicId: 'engineering',
                    deadline: null,
                    similarity: 0.75,
                },
            ]);

            const result = await service.buildContext('user-1', 'topics');

            expect(result).toContain('slack/engineering');
        });

        it('returns empty string when RAG fails', async () => {
            mockEmbeddingService.embed.mockRejectedValue(
                new Error('API error'),
            );

            const result = await service.buildContext('user-1', 'tasks');

            expect(result).toBe('');
        });

        it('passes the user message as query to embedding service', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([]);

            await service.buildContext('user-1', 'find my tasks');

            expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
                'find my tasks',
            );
        });

        it('calls searchSimilar with primary threshold 0.65 and limit 10', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'task',
                    type: 'TASK',
                    status: null,
                    priority: null,
                    sourcePlugin: null,
                    groupId: null,
                    channelId: null,
                    topicId: null,
                    deadline: null,
                    similarity: 0.70,
                },
            ]);

            await service.buildContext('user-1', 'tasks');

            expect(mockEmbeddingRepo.searchSimilar).toHaveBeenCalledWith(
                [0.1, 0.2, 0.3],
                10,
                'user-1',
                0.65,
            );
        });

        it('calls findByFilters when type/status keywords are present', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([]);
            mockEmbeddingRepo.findByFilters.mockResolvedValue([
                {
                    insightVersionId: 'v1',
                    insightId: 'i1',
                    content: 'task',
                    type: 'TASK',
                    status: 'PENDING',
                    priority: null,
                    sourcePlugin: null,
                    groupId: null,
                    channelId: null,
                    topicId: null,
                    deadline: null,
                    similarity: 1.0,
                },
            ]);

            const result = await service.buildContext('user-1', 'list all pending tasks');

            expect(mockEmbeddingRepo.findByFilters).toHaveBeenCalledWith(
                'user-1',
                50,
                { types: ['TASK'], statuses: ['PENDING'] },
            );
            expect(result).toContain('task');
        });

        it('deduplicates results from findByFilters and searchSimilar', async () => {
            mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
            
            const sharedResult = {
                insightVersionId: 'v1',
                insightId: 'i1',
                content: 'task',
                type: 'TASK',
                status: 'PENDING',
                priority: null,
                sourcePlugin: null,
                groupId: null,
                channelId: null,
                topicId: null,
                deadline: null,
                similarity: 0.9,
            };

            mockEmbeddingRepo.findByFilters.mockResolvedValue([
                { ...sharedResult, similarity: 1.0 },
            ]);
            mockEmbeddingRepo.searchSimilar.mockResolvedValue([
                sharedResult,
            ]);

            const result = await service.buildContext('user-1', 'pending tasks');

            // Expect to see the string only once in the context, but since we format it
            // let's just make sure it returns something and deduplicated correctly.
            const matches = result.match(/- \*\*TASK\*\*/g);
            expect(matches).toHaveLength(1);
        });
    });
});
