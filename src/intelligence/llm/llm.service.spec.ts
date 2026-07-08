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
});
