import { Injectable } from '@nestjs/common';
import { initChatModel } from 'langchain/chat_models/universal';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

@Injectable()
export class LlmService {
  private requireEnv(key: string): string {
    const value = process.env[key];

    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }

  async createLLM(): Promise<BaseChatModel> {
    const provider = this.requireEnv('LLM_PROVIDER');
    const model = this.requireEnv('LLM_MODEL');

    const providerFields =
      provider === 'ollama'
        ? {
            baseUrl: this.requireEnv('LLM_BASE_URL'),
            think: false,
          }
        : {
            apiKey: this.requireEnv('LLM_API_KEY'),
          };

    return initChatModel(model, {
      modelProvider: provider,
      temperature: 0,
      streaming: false,
      ...providerFields,
    });
  }
}
