import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { initChatModel } from 'langchain/chat_models/universal';
import { AIMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';

jest.mock('langchain/chat_models/universal', () => ({
    initChatModel: jest.fn(),
}));

const mockInitChatModel = initChatModel as jest.Mock;

function createMockConfig(
    overrides: Record<string, string> = {},
): jest.Mocked<ConfigService> {
    const defaults: Record<string, string> = {
        'llm.provider': '',
        'llm.model': '',
        'llm.apiKey': '',
        'llm.baseUrl': '',
    };
    const config = { ...defaults, ...overrides };

    return {
        get: jest.fn((key: string) => config[key] ?? ''),
    } as unknown as jest.Mocked<ConfigService>;
}

describe('LlmService', () => {
    let service: LlmService;
    let mockConfig: jest.Mocked<ConfigService>;

    beforeEach(async () => {
        jest.resetAllMocks();
        mockConfig = createMockConfig();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LlmService,
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();

        service = module.get<LlmService>(LlmService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createLLM - required config validation', () => {
        it('throws when llm.provider is missing', async () => {
            mockConfig = createMockConfig({
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required config: llm.provider',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when llm.provider is an empty string', async () => {
            mockConfig = createMockConfig({
                'llm.provider': '',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required config: llm.provider',
            );
        });

        it('throws when llm.model is missing', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required config: llm.model',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when llm.apiKey is missing for non-ollama providers', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': '',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({});

            await service.createLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith(
                'gpt-4',
                expect.objectContaining({
                    apiKey: '',
                }),
            );
        });

        it('throws when llm.baseUrl is missing for ollama', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'ollama',
                'llm.model': 'llama3',
                'llm.baseUrl': '',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({});

            await service.createLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith(
                'llama3',
                expect.objectContaining({
                    baseUrl: '',
                }),
            );
        });
    });

    describe('createLLM - error propagation', () => {
        it('propagates errors thrown by initChatModel', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockRejectedValue(
                new Error('provider unreachable'),
            );

            await expect(service.createLLM()).rejects.toThrow(
                'provider unreachable',
            );
        });
    });

    describe('createStreamingLLM', () => {
        it('throws when llm.provider is missing', async () => {
            mockConfig = createMockConfig({
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            await expect(service.createStreamingLLM()).rejects.toThrow(
                'Missing required config: llm.provider',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when llm.model is missing', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            await expect(service.createStreamingLLM()).rejects.toThrow(
                'Missing required config: llm.model',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('returns a model with streaming enabled for openai', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            const mockStream = jest.fn();
            mockInitChatModel.mockResolvedValue({ stream: mockStream });

            const llm = await service.createStreamingLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith(
                'gpt-4',
                expect.objectContaining({
                    modelProvider: 'openai',
                    streaming: true,
                    temperature: 0,
                }),
            );
            expect(llm).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(llm.stream).toBeDefined();
        });

        it('returns a model with streaming enabled for ollama', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'ollama',
                'llm.model': 'llama3',
                'llm.baseUrl': 'http://localhost:11434',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({ stream: jest.fn() });

            await service.createStreamingLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith(
                'llama3',
                expect.objectContaining({
                    modelProvider: 'ollama',
                    streaming: true,
                    temperature: 0,
                    baseUrl: 'http://localhost:11434',
                }),
            );
        });

        it('returns a model with streaming enabled for openrouter', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openrouter',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'or-key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({ stream: jest.fn() });

            await service.createStreamingLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith(
                'gpt-4',
                expect.objectContaining({
                    modelProvider: 'openai',
                    streaming: true,
                    temperature: 0,
                    apiKey: 'or-key',
                    configuration: {
                        baseURL: 'https://openrouter.ai/api/v1',
                    },
                }),
            );
        });

        it('propagates errors thrown by initChatModel', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockRejectedValue(
                new Error('provider unreachable'),
            );

            await expect(service.createStreamingLLM()).rejects.toThrow(
                'provider unreachable',
            );
        });
    });

    describe('createToolModel', () => {
        it('throws when bindTools is undefined on the model', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({});

            await expect(service.createToolModel([])).rejects.toThrow(
                'does not support tool calling',
            );
        });

        it('throws when config vars are missing', async () => {
            await expect(service.createToolModel([])).rejects.toThrow(
                'Missing required config',
            );
        });

        it('binds tools and returns the runnable', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            const mockRunnable = { invoke: jest.fn() };
            const mockBindTools = jest.fn().mockReturnValue(mockRunnable);
            mockInitChatModel.mockResolvedValue({ bindTools: mockBindTools });

            const tools = [{ name: 't1' }] as unknown as StructuredTool[];
            const result = await service.createToolModel(tools);

            expect(mockBindTools).toHaveBeenCalledWith(tools);
            expect(result).toBe(mockRunnable);
        });
    });

    describe('createToolChain', () => {
        it('throws when bindTools is undefined on the model', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({});

            await expect(
                service.createToolChain({ tools: [] }),
            ).rejects.toThrow('does not support tool calling');
        });

        it('throws when config vars are missing', async () => {
            await expect(
                service.createToolChain({ tools: [] }),
            ).rejects.toThrow('Missing required config');
        });

        it('returns a chain that resolves with content when no tool calls', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            const mockToolModelInvoke = jest
                .fn()
                .mockResolvedValue(new AIMessage('hello world'));

            mockInitChatModel.mockResolvedValue({
                bindTools: jest
                    .fn()
                    .mockReturnValue({ invoke: mockToolModelInvoke }),
            });

            const chain = await service.createToolChain({
                tools: [],
                maxIterations: 3,
            });

            const result = await chain.invoke({ messages: [] });

            expect(result).toBe('hello world');
        });

        it('executes tool calls and returns final content', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            const toolInvoke = jest.fn().mockResolvedValue('tool_output');

            const tools = [
                { name: 'test_tool', invoke: toolInvoke },
            ] as unknown as StructuredTool[];

            const mockToolModelInvoke = jest
                .fn()
                .mockResolvedValueOnce(
                    new AIMessage({
                        content: '',
                        tool_calls: [
                            { name: 'test_tool', args: {}, id: 'call_1' },
                        ],
                    }),
                )
                .mockResolvedValueOnce(new AIMessage('final result'));

            mockInitChatModel.mockResolvedValue({
                bindTools: jest
                    .fn()
                    .mockReturnValue({ invoke: mockToolModelInvoke }),
            });

            const chain = await service.createToolChain({
                tools,
                maxIterations: 3,
            });

            const result = await chain.invoke({ messages: [] });

            expect(toolInvoke).toHaveBeenCalledWith({});
            expect(result).toBe('final result');
        });

        it('throws when tool calling exceeds max iterations', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4',
                'llm.apiKey': 'key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            const tools = [
                { name: 'test_tool', invoke: jest.fn().mockResolvedValue('x') },
            ] as unknown as StructuredTool[];

            const mockToolModelInvoke = jest.fn().mockResolvedValue(
                new AIMessage({
                    content: '',
                    tool_calls: [{ name: 'test_tool', args: {}, id: 'call_1' }],
                }),
            );

            mockInitChatModel.mockResolvedValue({
                bindTools: jest
                    .fn()
                    .mockReturnValue({ invoke: mockToolModelInvoke }),
            });

            const chain = await service.createToolChain({
                tools,
                maxIterations: 3,
            });

            await expect(chain.invoke({ messages: [] })).rejects.toThrow(
                'exceeded max iterations',
            );
        });
    });

    describe('createGraphLLM', () => {
        it('uses graph-specific config when provided', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4o',
                'llm.apiKey': 'main-key',
                'llm.graphProvider': 'anthropic',
                'llm.graphModel': 'claude-3-5-sonnet',
                'llm.graphApiKey': 'graph-key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({} as any);

            await service.createGraphLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith('claude-3-5-sonnet', {
                modelProvider: 'anthropic',
                temperature: 0,
                streaming: false,
                apiKey: 'graph-key',
            });
        });

        it('falls back to main LLM config when graph config is absent', async () => {
            mockConfig = createMockConfig({
                'llm.provider': 'openai',
                'llm.model': 'gpt-4o-mini',
                'llm.apiKey': 'main-key',
            });
            const module = await Test.createTestingModule({
                providers: [
                    LlmService,
                    { provide: ConfigService, useValue: mockConfig },
                ],
            }).compile();
            service = module.get<LlmService>(LlmService);

            mockInitChatModel.mockResolvedValue({} as any);

            await service.createGraphLLM();

            expect(mockInitChatModel).toHaveBeenCalledWith('gpt-4o-mini', {
                modelProvider: 'openai',
                temperature: 0,
                streaming: false,
                apiKey: 'main-key',
            });
        });
    });
});

