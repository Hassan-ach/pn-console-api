import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { LlmService } from '../intelligence/llm/llm.service';
import { ChatContextService } from './chat-context.service';

interface MockAppDb {
    $transaction: jest.Mock;
    chatMessage: Record<string, jest.Mock>;
    conversation: Record<string, jest.Mock>;
}

function createMockAppDb(): MockAppDb {
    return {
        $transaction: jest
            .fn()
            .mockImplementation(
                async (
                    cb: (tx: { chatMessage: { delete: jest.Mock } }) => unknown,
                ) => {
                    const tx = {
                        chatMessage: {
                            delete: jest.fn().mockResolvedValue({}),
                        },
                    };
                    return cb(tx);
                },
            ),
        chatMessage: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
                id: 'msg-1',
                role: 'USER',
                content: 'test',
                createdAt: new Date(),
            }),
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            count: jest.fn().mockResolvedValue(0),
        },
        conversation: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
                id: 'conv-1',
                title: 'New chat',
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
            update: jest.fn().mockResolvedValue({}),
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
            .mockResolvedValue(
                '## Current Date\n\n2026-07-29T00:00:00.000Z\n\n## Relevant Insights\n\nmock context',
            ),
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
        it('calls findMany with correct userId and conversationId', async () => {
            await service.getHistory('user-1', 'conv-1');

            expect(mockAppDb.chatMessage.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-1', conversationId: 'conv-1' },
                orderBy: { createdAt: 'asc' },
                skip: 0,
                take: 50,
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

            const result = await service.getHistory('user-1', 'conv-1');

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

            const result = await service.getHistory('user-1', 'conv-1');

            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('hello');
            expect(result[1].content).toBe('hi');
        });
    });

    describe('getConversations', () => {
        it('calls findMany with correct userId', async () => {
            mockAppDb.conversation.findMany.mockResolvedValue([]);

            await service.getConversations('user-1');

            expect(mockAppDb.conversation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                    orderBy: { updatedAt: 'desc' },
                }),
            );
        });
    });

    describe('createConversation', () => {
        it('creates a new conversation', async () => {
            mockAppDb.conversation.create.mockResolvedValue({
                id: 'conv-new',
                title: 'New chat',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.createConversation('user-1');

            expect(mockAppDb.conversation.create).toHaveBeenCalledWith({
                data: { userId: 'user-1' },
            });
            expect(result.id).toBe('conv-new');
        });
    });

    describe('resolveConversation', () => {
        it('returns existing conversation when conversationId is provided', async () => {
            mockAppDb.conversation.findFirst.mockResolvedValue({
                id: 'conv-existing',
                userId: 'user-1',
                title: 'Test',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.resolveConversation(
                'user-1',
                'conv-existing',
            );

            expect(result).toBe('conv-existing');
        });

        it('creates new conversation when no recent one exists', async () => {
            mockAppDb.conversation.findFirst.mockResolvedValue(null);
            mockAppDb.conversation.create.mockResolvedValue({
                id: 'conv-new',
                title: 'New chat',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.resolveConversation('user-1');

            expect(mockAppDb.conversation.create).toHaveBeenCalledWith({
                data: { userId: 'user-1' },
            });
            expect(result).toBe('conv-new');
        });
    });

    describe('streamResponse', () => {
        beforeEach(() => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '2',
                    role: 'ASSISTANT',
                    content: 'old answer',
                    createdAt: new Date(),
                },
                {
                    id: '1',
                    role: 'USER',
                    content: 'old question',
                    createdAt: new Date(),
                },
            ]);
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: jest
                    .fn()
                    .mockResolvedValue(mockStream(['Hello', ' world'])),
            });
        });

        it('fetches history before saving messages', async () => {
            const callOrder: string[] = [];
            mockAppDb.chatMessage.findMany.mockImplementation(() => {
                callOrder.push('findMany');
                return Promise.resolve([]);
            });
            mockAppDb.chatMessage.create.mockImplementation(() => {
                callOrder.push('create');
                return Promise.resolve({
                    id: 'msg-1',
                    role: 'USER',
                    content: 'hello',
                    createdAt: new Date(),
                });
            });

            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(callOrder[0]).toBe('findMany');
            expect(callOrder[1]).toBe('create');
        });

        it('saves both user message and assistant response after streaming', async () => {
            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'What are my tasks?',
            );
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(1, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
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
            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
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

        it('builds context via ChatContextService', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockChatContext.buildContext).toHaveBeenCalledWith(
                'user-1',
                'hello',
            );
        });

        it('loads last 20 messages with desc ordering for history', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId: 'user-1',
                        conversationId: 'conv-1',
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                }),
            );
        });

        it('constructs LangChain messages with system prompt and context', async () => {
            const llmStream = jest.fn().mockResolvedValue(mockStream(['ok']));
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: llmStream,
            });

            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(llmStream).toHaveBeenCalled();
            const messages = llmStream.mock.calls[0][0] as {
                content: string;
            }[];
            expect(messages[0]).toHaveProperty('content');
            expect(messages[0].content).toContain('mock context');
            expect(messages[1].content).toBe('old question');
            expect(messages[2].content).toBe('old answer');
            expect(messages[3].content).toBe('hello');
        });

        it('includes no-context fallback message when context is empty', async () => {
            mockChatContext.buildContext.mockResolvedValue('');
            const llmStream = jest.fn().mockResolvedValue(mockStream(['ok']));
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: llmStream,
            });
            mockAppDb.chatMessage.findMany.mockResolvedValue([]);

            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(llmStream).toHaveBeenCalled();
            const messages = llmStream.mock.calls[0][0] as {
                content: string;
            }[];
            expect(messages[0].content).toContain(
                'No relevant insights found for this query',
            );
        });

        it('yields tokens from LLM stream', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('saves full assistant response after streaming', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
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

            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
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

            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            for await (const _token of gen) {
                // consume the stream
            }

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
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

        it('passes abort signal to LLM stream', async () => {
            const abortController = new AbortController();
            const llmStream = jest.fn().mockResolvedValue(mockStream(['ok']));
            mockLlmService.createStreamingLLM.mockResolvedValue({
                stream: llmStream,
            });

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'hello',
                abortController.signal,
            );
            for await (const _token of gen) {
                // consume the stream
            }

            expect(llmStream).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    signal: abortController.signal,
                }),
            );
        });
    });

    describe('retractLastMessages', () => {
        it('throws when there are fewer than 2 messages', async () => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '1',
                    role: 'USER',
                    content: 'hello',
                    createdAt: new Date(),
                },
            ]);

            await expect(
                service.retractLastMessages('user-1', 'conv-1'),
            ).rejects.toThrow('Not enough messages to retract');
        });

        it('throws when the last two messages are not USER+ASSISTANT', async () => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '1',
                    role: 'USER',
                    content: 'first',
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    role: 'USER',
                    content: 'second',
                    createdAt: new Date(),
                },
            ]);

            await expect(
                service.retractLastMessages('user-1', 'conv-1'),
            ).rejects.toThrow('not a valid USER+ASSISTANT pair');
        });

        it('deletes the last two messages via deleteMany', async () => {
            const messages = [
                { id: '1', role: 'USER' as const, createdAt: new Date() },
                { id: '2', role: 'ASSISTANT' as const, createdAt: new Date() },
            ];
            mockAppDb.chatMessage.findMany.mockResolvedValue(messages);

            await service.retractLastMessages('user-1', 'conv-1');

            expect(mockAppDb.chatMessage.deleteMany).toHaveBeenCalledWith({
                where: {
                    id: { in: ['1', '2'] },
                    userId: 'user-1',
                },
            });
        });
    });
});
