import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { LlmService } from '../intelligence/llm/llm.service';
import { ChatContextService } from './chat-context.service';
import { SearchToolsService } from '../intelligence/tools/search-tools.service';
import { GraphToolsService } from '../intelligence/tools/graph-tools.service';
import { AIMessageChunk } from '@langchain/core/messages';

type MockTx = {
    chatMessage: Record<string, jest.Mock>;
    conversation: Record<string, jest.Mock>;
};

interface MockAppDb {
    $transaction: jest.Mock;
    chatMessage: Record<string, jest.Mock>;
    conversation: Record<string, jest.Mock>;
}

function createMockAppDb(): MockAppDb {
    const mockCreateMsg = jest.fn().mockResolvedValue({
        id: 'msg-1',
        role: 'USER',
        content: 'test',
        createdAt: new Date(),
    });

    const mockFindManyMsg = jest.fn().mockResolvedValue([]);
    const mockDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const mockCount = jest.fn().mockResolvedValue(0);

    const mockFindFirstConv = jest.fn().mockResolvedValue(null);
    const mockFindUniqueConv = jest.fn().mockResolvedValue(null);
    const mockFindManyConv = jest.fn().mockResolvedValue([]);
    const mockCreateConv = jest.fn().mockResolvedValue({
        id: 'conv-1',
        title: 'New chat',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    const mockUpdateConv = jest.fn().mockResolvedValue({});

    const tx: MockTx = {
        chatMessage: {
            create: mockCreateMsg,
            findMany: mockFindManyMsg,
            deleteMany: mockDeleteMany,
            count: mockCount,
        },
        conversation: {
            findFirst: mockFindFirstConv,
            findUnique: mockFindUniqueConv,
            findMany: mockFindManyConv,
            create: mockCreateConv,
            update: mockUpdateConv,
        },
    };

    return {
        $transaction: jest
            .fn()
            .mockImplementation(async (cb: (tx: MockTx) => unknown) => cb(tx)),
        chatMessage: {
            findMany: mockFindManyMsg,
            create: mockCreateMsg,
            deleteMany: mockDeleteMany,
            count: mockCount,
        },
        conversation: {
            findFirst: mockFindFirstConv,
            findUnique: mockFindUniqueConv,
            findMany: mockFindManyConv,
            create: mockCreateConv,
            update: mockUpdateConv,
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

function createMockSearchToolsService() {
    return {
        getTools: jest.fn().mockReturnValue([
            {
                name: 'search_raw_messages',
                invoke: jest.fn().mockResolvedValue('[]'),
            },
            {
                name: 'search_insights',
                invoke: jest.fn().mockResolvedValue('[]'),
            },
            {
                name: 'retrieve_relevant_insights',
                invoke: jest.fn().mockResolvedValue('[]'),
            },
            {
                name: 'resolve_user_by_platform_id',
                invoke: jest.fn().mockResolvedValue('[]'),
            },
        ]),
    };
}

function createMockGraphToolsService() {
    return {
        getTools: jest.fn().mockReturnValue([
            { name: 'search_graph', invoke: jest.fn().mockResolvedValue('[]') },
            { name: 'get_entity', invoke: jest.fn().mockResolvedValue('{}') },
            {
                name: 'get_neighbors',
                invoke: jest.fn().mockResolvedValue('[]'),
            },
        ]),
    };
}

async function* mockStream(tokens: string[]) {
    for (const token of tokens) {
        yield new AIMessageChunk({ content: token });
    }
}

describe('ChatService', () => {
    let service: ChatService;
    let mockAppDb: ReturnType<typeof createMockAppDb>;
    let mockLlmService: ReturnType<typeof createMockLlmService>;
    let mockChatContext: ReturnType<typeof createMockChatContextService>;
    let mockSearchTools: ReturnType<typeof createMockSearchToolsService>;
    let mockGraphTools: ReturnType<typeof createMockGraphToolsService>;

    beforeEach(async () => {
        mockAppDb = createMockAppDb();
        mockLlmService = createMockLlmService();
        mockChatContext = createMockChatContextService();
        mockSearchTools = createMockSearchToolsService();
        mockGraphTools = createMockGraphToolsService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,
                { provide: AppDbService, useValue: mockAppDb },
                { provide: LlmService, useValue: mockLlmService },
                { provide: ChatContextService, useValue: mockChatContext },
                { provide: SearchToolsService, useValue: mockSearchTools },
                { provide: GraphToolsService, useValue: mockGraphTools },
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

        it('resolves latest conversation when conversationId is omitted', async () => {
            mockAppDb.conversation.findFirst.mockResolvedValue({
                id: 'conv-latest',
            });

            await service.getHistory('user-1');

            expect(mockAppDb.conversation.findFirst).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                orderBy: { updatedAt: 'desc' },
                select: { id: true },
            });
            expect(mockAppDb.chatMessage.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1', conversationId: 'conv-latest' },
                }),
            );
        });

        it('returns empty array when conversationId is omitted and no conversations exist', async () => {
            mockAppDb.conversation.findFirst.mockResolvedValue(null);

            const result = await service.getHistory('user-1');

            expect(result).toEqual([]);
            expect(mockAppDb.chatMessage.findMany).not.toHaveBeenCalled();
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
            mockAppDb.conversation.findUnique = jest.fn().mockResolvedValue({
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
        async function consumeStream(
            gen: AsyncGenerator<unknown>,
        ): Promise<void> {
            for await (const token of gen) {
                expect(token).toBeDefined();
            }
        }

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
            await consumeStream(gen);

            expect(callOrder[0]).toBe('findMany');
            expect(callOrder[1]).toBe('create');
        });

        it('saves both user message and assistant response after streaming', async () => {
            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'What are my tasks?',
            );
            await consumeStream(gen);

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(1, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
                    role: 'USER',
                    content: 'What are my tasks?',
                },
            });
            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
                    role: 'ASSISTANT',
                    content: 'Hello world',
                },
            });
        });

        it('builds context via ChatContextService', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            await consumeStream(gen);

            expect(mockChatContext.buildContext).toHaveBeenCalledWith(
                'user-1',
                'hello',
            );
        });

        it('loads last 20 messages with desc ordering for history', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            await consumeStream(gen);

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
            await consumeStream(gen);

            expect(llmStream).toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
            await consumeStream(gen);

            expect(llmStream).toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

            expect(tokens).toEqual(['Hello world']);
        });

        it('saves full assistant response after streaming', async () => {
            const gen = service.streamResponse('user-1', 'conv-1', 'hello');
            await consumeStream(gen);

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
                    role: 'ASSISTANT',
                    content: 'Hello world',
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
            await consumeStream(gen);

            expect(mockAppDb.chatMessage.create).toHaveBeenNthCalledWith(2, {
                data: {
                    userId: 'user-1',
                    conversationId: 'conv-1',
                    role: 'ASSISTANT',
                    content:
                        'Sorry, an error occurred while processing your request.',
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
            await consumeStream(gen);

            expect(llmStream).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    signal: abortController.signal,
                }),
            );
        });

        it('executes tool call when requested by LLM stream', async () => {
            const searchToolInvoke = jest
                .fn()
                .mockResolvedValue(
                    '[{"id":"msg-99","content":"found message"}]',
                );
            mockSearchTools.getTools.mockReturnValue([
                { name: 'search_raw_messages', invoke: searchToolInvoke },
            ]);

            const mockToolCallStream = (async function* () {
                yield new AIMessageChunk({
                    content: '',
                    tool_calls: [
                        {
                            id: 'call-1',
                            name: 'search_raw_messages',
                            args: { query: 'urgent' },
                        },
                    ],
                });
            })();

            const mockFinalStream = (async function* () {
                yield new AIMessageChunk({
                    content: 'Found the raw message details.',
                });
            })();

            const streamFn = jest
                .fn()
                .mockResolvedValueOnce(mockToolCallStream)
                .mockResolvedValueOnce(mockFinalStream);

            const mockLlm = {
                bindTools: jest.fn().mockReturnThis(),
                stream: streamFn,
            };

            mockLlmService.createStreamingLLM.mockResolvedValue(mockLlm);

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'Search urgent messages',
            );
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(searchToolInvoke).toHaveBeenCalledWith({ query: 'urgent' });
            expect(tokens.join('')).toBe('Found the raw message details.');
        });

        it('handles Gemini functionCall content array blocks without leaking JSON to chat', async () => {
            const searchToolInvoke = jest
                .fn()
                .mockResolvedValue(
                    '[{"id":"msg-100","content":"afternoon meeting"}]',
                );
            mockSearchTools.getTools.mockReturnValue([
                { name: 'search_raw_messages', invoke: searchToolInvoke },
            ]);

            const mockGeminiToolCallStream = (async function* () {
                yield new AIMessageChunk({
                    content: [
                        {
                            type: 'functionCall',
                            functionCall: {
                                name: 'search_raw_messages',
                                args: { query: 'afternoon' },
                                id: 'AkCrAEFa',
                            },
                        },
                    ],
                    tool_calls: [
                        {
                            name: 'search_raw_messages',
                            args: { query: 'afternoon' },
                            id: 'AkCrAEFa',
                        },
                    ],
                });
            })();

            const mockFinalAnswerStream = (async function* () {
                yield new AIMessageChunk({
                    content: 'You have a meeting scheduled this afternoon.',
                });
            })();

            const streamFn = jest
                .fn()
                .mockResolvedValueOnce(mockGeminiToolCallStream)
                .mockResolvedValueOnce(mockFinalAnswerStream);

            const mockLlm = {
                bindTools: jest.fn().mockReturnThis(),
                stream: streamFn,
            };

            mockLlmService.createStreamingLLM.mockResolvedValue(mockLlm);

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'what are my task for this afternoon?',
            );
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(searchToolInvoke).toHaveBeenCalledWith({
                query: 'afternoon',
            });
            expect(tokens.join('')).toBe(
                'You have a meeting scheduled this afternoon.',
            );
            expect(tokens.join('')).not.toContain('functionCall');
        });

        it('attaches reasoning_content to AIMessage additional_kwargs for thinking models', async () => {
            const searchToolInvoke = jest.fn().mockResolvedValue('[]');
            mockSearchTools.getTools.mockReturnValue([
                { name: 'search_raw_messages', invoke: searchToolInvoke },
            ]);

            const mockThinkingToolStream = (async function* () {
                yield new AIMessageChunk({
                    content: '',
                    response_metadata: {
                        reasoning_content:
                            'Let me search messages to find the user info.',
                    },
                    tool_calls: [
                        {
                            name: 'search_raw_messages',
                            args: { query: 'hassan' },
                            id: 'call_01',
                        },
                    ],
                });
            })();

            const mockFinalStream = (async function* () {
                yield new AIMessageChunk({ content: 'Found user info.' });
            })();

            const streamFn = jest
                .fn()
                .mockResolvedValueOnce(mockThinkingToolStream)
                .mockResolvedValueOnce(mockFinalStream);

            const mockLlm = {
                bindTools: jest.fn().mockReturnThis(),
                stream: streamFn,
            };

            mockLlmService.createStreamingLLM.mockResolvedValue(mockLlm);

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'search hassan',
            );
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(streamFn).toHaveBeenCalledTimes(2);
            const calls = streamFn.mock.calls as unknown[][];
            const secondCallMessages = (calls[1]?.[0] ?? []) as Array<{
                content: string;
                tool_calls?: unknown[];
                additional_kwargs?: { reasoning_content?: string };
            }>;
            const toolCallAiMessage = secondCallMessages.find(
                (m) => m.tool_calls && m.tool_calls.length > 0,
            );
            expect(toolCallAiMessage).toBeDefined();
            expect(toolCallAiMessage?.tool_calls).toEqual([
                {
                    name: 'search_raw_messages',
                    args: { query: 'hassan' },
                    id: 'call_01',
                },
            ]);
        });

        it('parses DSML tool calls from text content and executes them', async () => {
            const retrieveToolInvoke = jest
                .fn()
                .mockResolvedValue('["stand-up notes"]');
            const searchToolInvoke = jest
                .fn()
                .mockResolvedValue('["user story 123"]');

            mockSearchTools.getTools.mockReturnValue([
                {
                    name: 'retrieve_relevant_insights',
                    invoke: retrieveToolInvoke,
                },
                { name: 'search_insights', invoke: searchToolInvoke },
            ]);

            const mockDsmlStream = (async function* () {
                yield new AIMessageChunk({
                    content: `<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="retrieve_relevant_insights">
<｜｜DSML｜｜parameter name="query" string="true">daily activities stand-up meeting user story tasks</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="search_insights">
<｜｜DSML｜｜parameter name="query" string="true">stand-up user story meeting</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>`,
                });
            })();

            const mockFinalStream = (async function* () {
                yield new AIMessageChunk({
                    content:
                        'Here is your daily summary: You attended stand-up and worked on user story 123.',
                });
            })();

            const streamFn = jest
                .fn()
                .mockResolvedValueOnce(mockDsmlStream)
                .mockResolvedValueOnce(mockFinalStream);

            const mockLlm = {
                bindTools: jest.fn().mockReturnThis(),
                stream: streamFn,
            };

            mockLlmService.createStreamingLLM.mockResolvedValue(mockLlm);

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'Summarize my day',
            );
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(retrieveToolInvoke).toHaveBeenCalledWith({
                query: 'daily activities stand-up meeting user story tasks',
            });
            expect(searchToolInvoke).toHaveBeenCalledWith({
                query: 'stand-up user story meeting',
            });
            expect(tokens.join('')).toBe(
                'Here is your daily summary: You attended stand-up and worked on user story 123.',
            );
        });

        it('detects duplicate tool call loop and forces final response synthesis', async () => {
            const searchToolInvoke = jest.fn().mockResolvedValue('["results"]');
            mockSearchTools.getTools.mockReturnValue([
                { name: 'search_insights', invoke: searchToolInvoke },
            ]);

            const createDuplicateToolCallStream = () =>
                (async function* () {
                    yield new AIMessageChunk({
                        content: '',
                        tool_calls: [
                            {
                                name: 'search_insights',
                                args: { query: 'same query' },
                                id: 'call_01',
                            },
                        ],
                    });
                })();

            const createSynthesisStream = () =>
                (async function* () {
                    yield new AIMessageChunk({
                        content: 'Synthesized response after duplicate loop.',
                    });
                })();

            // 1st turn: LLM emits tool call. 2nd turn: LLM emits IDENTICAL tool call -> loop detected -> 3rd turn: synthesis stream called!
            const streamFn = jest
                .fn()
                .mockImplementationOnce(() => createDuplicateToolCallStream())
                .mockImplementationOnce(() => createDuplicateToolCallStream())
                .mockImplementationOnce(() => createSynthesisStream());

            const mockLlm = {
                bindTools: jest.fn().mockReturnThis(),
                stream: streamFn,
            };

            mockLlmService.createStreamingLLM.mockResolvedValue(mockLlm);

            const gen = service.streamResponse(
                'user-1',
                'conv-1',
                'Find insights',
            );
            const tokens: string[] = [];
            for await (const token of gen) {
                tokens.push(token);
            }

            expect(tokens.join('')).toBe(
                'Synthesized response after duplicate loop.',
            );
            // Must have broken out early on 2nd turn rather than running up to maxIterations
            expect(streamFn).toHaveBeenCalledTimes(3);
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

        it('throws when the last two messages are not USER+ASSISTANT in order', async () => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '2',
                    role: 'USER',
                    content: 'second',
                    createdAt: new Date(),
                },
                {
                    id: '1',
                    role: 'USER',
                    content: 'first',
                    createdAt: new Date(),
                },
            ]);

            await expect(
                service.retractLastMessages('user-1', 'conv-1'),
            ).rejects.toThrow('not a valid USER+ASSISTANT pair');
        });

        it('throws when newest is not ASSISTANT', async () => {
            mockAppDb.chatMessage.findMany.mockResolvedValue([
                {
                    id: '2',
                    role: 'ASSISTANT',
                    content: 'answer',
                    createdAt: new Date(),
                },
                {
                    id: '1',
                    role: 'ASSISTANT',
                    content: 'another answer',
                    createdAt: new Date(),
                },
            ]);

            await expect(
                service.retractLastMessages('user-1', 'conv-1'),
            ).rejects.toThrow('not a valid USER+ASSISTANT pair');
        });

        it('deletes the last two messages via deleteMany', async () => {
            const messages = [
                { id: '2', role: 'ASSISTANT' as const, createdAt: new Date() },
                { id: '1', role: 'USER' as const, createdAt: new Date() },
            ];
            mockAppDb.chatMessage.findMany.mockResolvedValue(messages);

            await service.retractLastMessages('user-1', 'conv-1');

            expect(mockAppDb.chatMessage.deleteMany).toHaveBeenCalledWith({
                where: {
                    id: { in: ['2', '1'] },
                    userId: 'user-1',
                },
            });
        });
    });
});
