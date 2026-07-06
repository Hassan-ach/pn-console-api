import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { initChatModel } from 'langchain/chat_models/universal';

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

    it('throws when LLM_API_KEY is missing for a non-ollama provider', async () => {
      process.env.LLM_PROVIDER = 'openai';
      process.env.LLM_MODEL = 'gpt-4';

      await expect(service.createLLM()).rejects.toThrow(
        'Missing required environment variable: LLM_API_KEY',
      );
      expect(mockInitChatModel).not.toHaveBeenCalled();
    });

    it('throws when LLM_API_KEY is missing for ollama (used as baseUrl)', async () => {
      process.env.LLM_PROVIDER = 'ollama';
      process.env.LLM_MODEL = 'llama3';

      await expect(service.createLLM()).rejects.toThrow(
        'Missing required environment variable: LLM_API_KEY',
      );
    });
  });

  describe('createLLM - provider mapping', () => {
    it.each([
      ['openai', 'openai'],
      ['anthropic', 'anthropic'],
      ['google', 'google-genai'],
      ['grok', 'xai'],
    ] as const)(
      'maps "%s" to langchain provider "%s" and passes an apiKey field',
      async (provider, expectedModelProvider) => {
        process.env.LLM_PROVIDER = provider;
        process.env.LLM_MODEL = 'some-model';
        process.env.LLM_API_KEY = 'secret-key';

        mockInitChatModel.mockResolvedValue({ id: 'fake-model' });

        const result = await service.createLLM();

        expect(mockInitChatModel).toHaveBeenCalledTimes(1);
        expect(mockInitChatModel).toHaveBeenCalledWith('some-model', {
          modelProvider: expectedModelProvider,
          temperature: 0,
          streaming: false,
          apiKey: 'secret-key',
        });
        expect(result).toEqual({ id: 'fake-model' });
      },
    );

    it('passes baseUrl and think:false instead of apiKey for ollama', async () => {
      process.env.LLM_PROVIDER = 'ollama';
      process.env.LLM_MODEL = 'llama3';
      process.env.LLM_API_KEY = 'http://localhost:11434';

      mockInitChatModel.mockResolvedValue({ id: 'fake-ollama-model' });

      await service.createLLM();

      expect(mockInitChatModel).toHaveBeenCalledWith('llama3', {
        modelProvider: 'ollama',
        temperature: 0,
        streaming: false,
        baseUrl: 'http://localhost:11434',
        think: false,
      });
    });
  });

  describe('createLLM - error propagation', () => {
    it('propagates errors thrown by initChatModel', async () => {
      process.env.LLM_PROVIDER = 'openai';
      process.env.LLM_MODEL = 'gpt-4';
      process.env.LLM_API_KEY = 'key';

      mockInitChatModel.mockRejectedValue(new Error('provider unreachable'));

      await expect(service.createLLM()).rejects.toThrow(
        'provider unreachable',
      );
    });
  });
});
