import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { initChatModel } from 'langchain/chat_models/universal';
import { AIMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';

jest.mock('langchain/chat_models/universal', () => ({
    initChatModel: jest.fn(),
}));

const mockInitChatModel = initChatModel as jest.Mock;

describe('LlmService', () => {
    let service: LlmService;
    const ORIGINAL_ENV = process.env;

    beforeEach(async () => {
        jest.resetAllMocks();

        process.env = { ...ORIGINAL_ENV };
        delete process.env.LLM_PROVIDER;
        delete process.env.LLM_MODEL;
        delete process.env.LLM_API_KEY;
        delete process.env.LLM_BASE_URL;

        const module: TestingModule = await Test.createTestingModule({
            providers: [LlmService],
        }).compile();

        service = module.get<LlmService>(LlmService);
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createLLM - required env validation', () => {
        it('throws when LLM_PROVIDER is missing', async () => {
            process.env.LLM_MODEL = 'gpt-4';
            process.env.LLM_API_KEY = 'key';

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required environment variable: LLM_PROVIDER',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when LLM_PROVIDER is an empty string', async () => {
            process.env.LLM_PROVIDER = '';
            process.env.LLM_MODEL = 'gpt-4';
            process.env.LLM_API_KEY = 'key';

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required environment variable: LLM_PROVIDER',
            );
        });

        it('throws when LLM_MODEL is missing', async () => {
            process.env.LLM_PROVIDER = 'openai';
            process.env.LLM_API_KEY = 'key';

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required environment variable: LLM_MODEL',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when LLM_API_KEY is missing for non-ollama providers', async () => {
            process.env.LLM_PROVIDER = 'openai';
            process.env.LLM_MODEL = 'gpt-4';

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required environment variable: LLM_API_KEY',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });

        it('throws when LLM_BASE_URL is missing for ollama', async () => {
            process.env.LLM_PROVIDER = 'ollama';
            process.env.LLM_MODEL = 'llama3';

            await expect(service.createLLM()).rejects.toThrow(
                'Missing required environment variable: LLM_BASE_URL',
            );

            expect(mockInitChatModel).not.toHaveBeenCalled();
        });
    });

    describe('createLLM - error propagation', () => {
        it('propagates errors thrown by initChatModel', async () => {
            process.env.LLM_PROVIDER = 'openai';
            process.env.LLM_MODEL = 'gpt-4';
            process.env.LLM_API_KEY = 'key';

            mockInitChatModel.mockRejectedValue(
                new Error('provider unreachable'),
            );

            await expect(service.createLLM()).rejects.toThrow(
                'provider unreachable',
            );
        });
    });

    describe('createToolModel', () => {
        function setEnv() {
            process.env.LLM_PROVIDER = 'openai';
            process.env.LLM_MODEL = 'gpt-4';
            process.env.LLM_API_KEY = 'key';
        }

        it('throws when bindTools is undefined on the model', async () => {
            setEnv();
            mockInitChatModel.mockResolvedValue({});

            await expect(service.createToolModel([])).rejects.toThrow(
                'does not support tool calling',
            );
        });

        it('throws when env vars are missing', async () => {
            await expect(service.createToolModel([])).rejects.toThrow(
                'Missing required environment variable',
            );
        });

        it('binds tools and returns the runnable', async () => {
            setEnv();

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
        function setEnv() {
            process.env.LLM_PROVIDER = 'openai';
            process.env.LLM_MODEL = 'gpt-4';
            process.env.LLM_API_KEY = 'key';
        }

        it('throws when bindTools is undefined on the model', async () => {
            setEnv();
            mockInitChatModel.mockResolvedValue({});

            await expect(
                service.createToolChain({ tools: [] }),
            ).rejects.toThrow('does not support tool calling');
        });

        it('throws when env vars are missing', async () => {
            await expect(
                service.createToolChain({ tools: [] }),
            ).rejects.toThrow('Missing required environment variable');
        });

        it('returns a chain that resolves with content when no tool calls', async () => {
            setEnv();

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
            setEnv();

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
            setEnv();

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
});
