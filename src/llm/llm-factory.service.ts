import { Injectable } from '@nestjs/common'
import { initChatModel } from 'langchain/chat_models/universal'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'grok'

const LANGCHAIN_PROVIDER_MAP: Record<LLMProvider, string> = {
  ollama: 'ollama',
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google-genai',
  grok: 'xai',
}

@Injectable()
export class LlmFactoryService {
  private requireEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
    return value
  }

  private readProvider(): LLMProvider {
    return this.requireEnv('LLM_PROVIDER') as LLMProvider
  }

  async createLLM(): Promise<BaseChatModel> {
    const provider = this.readProvider()
    const model = this.requireEnv('LLM_MODEL')
    const modelProvider = LANGCHAIN_PROVIDER_MAP[provider]

    const providerFields =
      provider === 'ollama'
        ? { baseUrl: this.requireEnv('LLM_API_KEY'), think: false }
        : { apiKey: this.requireEnv('LLM_API_KEY') }

    return initChatModel(model, {
      modelProvider,
      temperature: 0,
      streaming: false,
      ...providerFields,
    })
  }
}
