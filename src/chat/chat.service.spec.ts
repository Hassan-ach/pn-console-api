import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { LlmService } from '../intelligence/llm/llm.service';
import { ChatContextService } from './chat-context.service';

function createMockAppDb() {
    return {
        chatMessage: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
                id: 'msg-1',
                role: 'USER',
                content: 'test',
                createdAt: new Date(),
            }),
        },
    };
}

function createMockLlmService() {
    return {
        createStreamingLLM: jest.fn(),
    };
}

function createMockChatContextService() {
    return {
        buildContext: jest
            .fn()
            .mockResolvedValue('## User Insights\n\nmock context'),
    };
}

async function* mockStream(tokens: string[]) {
    for (const token of tokens) {
        yield { content: token };
    }
}

describe('ChatService', () => {
    let service: ChatService;
    let mockAppDb: ReturnType<typeof createMockAppDb>;
    let mockLlmService: ReturnType<typeof createMockLlmService>;
    let mockChatContext: ReturnType<typeof createMockChatContextService>;

    beforeEach(async () => {
        mockAppDb = createMockAppDb();
        mockLlmService = createMockLlmService();
        mockChatContext = createMockChatContextService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,
                { provide: AppDbService, useValue: mockAppDb },
                { provide: LlmService, useValue: mockLlmService },
                { provide: ChatContextService, useValue: mockChatContext },
            ],
        }).compile();

        service = module.get<ChatService>(ChatService);
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getHistory', () => {
        it('calls findMany with correct userId and ordering', async () => {
            await service.getHistory('user-1');

            expect(mockAppDb.chatMessage.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
        });

        it('returns empty array when no messages exist', async () => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([]);

            const result = await service.getHistory('user-1');

            expect(result).toEqual([]);
        });

        it('returns messages from the database', async () => {
            const messages = [
                {
                    id: '1',
                    role: 'USER',
                    content: 'hello',
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    role: 'ASSISTANT',
                    content: 'hi',
                    createdAt: new Date(),
                },
            ];
            mockAppDb.chatMessage.findMany.mockResolvedValue(messages);

            const result = await service.getHistory('user-1');

            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('hello');
            expect(result[1].content).toBe('hi');
        });
    });

    describe('saveMessage', () => {
        it('creates message with correct data', async () => {
            await service.saveMessage('user-1', 'USER', 'hello');

            expect(mockAppDb.chatMessage.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    role: 'USER',
                    content: 'hello',
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
        });

        it('returns the created message record', async () => {
            const mockRecord = {
                id: 'msg-123',
                role: 'ASSISTANT',
                content: 'response',
                createdAt: new Date('2026-07-27T10:00:00Z'),
            };
            mockAppDb.chatMessage.create.mockResolvedValue(mockRecord);

            const result = await service.saveMessage(
                'user-1',
                'ASSISTANT',
                'response',
            );

            expect(result).toEqual(mockRecord);
        });
    });

    describe('streamResponse', () => {
        beforeEach(() => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '1',
                    role: 'USER',
                    content: 'old question',
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    role: 'ASSISTANT',
                    content: 'old answer',
                    createdAt: new Date(),
                },
            ]);
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: jest
                    .fn()
                    .mockResolvedValue(mockStream(['Hello', ' world'])),
            });
        });

        it('saves user message before streaming', async () => {
            const gen = service.streamResponse('user-1', 'What are my tasks?');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(1, {
                data: {
                    userId: 'user-1',
                    role: 'USER',
                    content: 'What are my tasks?',
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
        });

        it('builds context via ChatContextService', async () => {
            const gen = service.streamResponse('user-1', 'hello');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockChatContext.buildContext).toHaveBeenCalledWith('user-1');
        });

        it('loads last 20 messages for history', async () => {
            const gen = service.streamResponse('user-1', 'hello');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.findMany).toHaveBeenCalled();
        });

        it('constructs LangChain messages with system prompt and context', async () => {
            const llmStream = jest.fn().mockResolvedValue(mockStream(['ok']));
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: llmStream,
            });

            const gen = service.streamResponse('user-1', 'hello');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(llmStream).toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const messages = llmStream.mock.calls[0][0] as {
                content: string;
            }[];
            expect(messages[0]).toHaveProperty('content');
            expect(messages[0].content).toContain('read-only assistant');
            expect(messages[0].content).toContain('mock context');
            expect(messages[1].content).toBe('old question');
            expect(messages[2].content).toBe('old answer');
            expect(messages[3].content).toBe('hello');
        });

        it('yields tokens from LLM stream', async () => {
            const gen = service.streamResponse('user-1', 'hello');
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('saves full assistant response after streaming', async () => {
            const gen = service.streamResponse('user-1', 'hello');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    role: 'ASSISTANT',
                    content: 'Hello world',
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
        });

        it('yields error token on stream failure', async () => {
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: jest
                    .fn()
                    .mockRejectedValue(new Error('LLM unavailable')),
            });

            const gen = service.streamResponse('user-1', 'hello');
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(tokens).toEqual([
                'Sorry, an error occurred while processing your request.',
            ]);
        });

        it('saves error as assistant response on failure', async () => {
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: jest
                    .fn()
                    .mockRejectedValue(new Error('LLM unavailable')),
            });

            const gen = service.streamResponse('user-1', 'hello');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    role: 'ASSISTANT',
                    content:
                        'Sorry, an error occurred while processing your request.',
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
        });
    });
});
