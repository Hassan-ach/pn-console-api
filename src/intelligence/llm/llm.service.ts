import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initChatModel } from 'langchain/chat_models/universal';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredTool } from '@langchain/core/tools';
import { Runnable, RunnableLambda } from '@langchain/core/runnables';
import { ToolMessage } from '@langchain/core/messages';
import { ToolCallingChainConfig, ToolChainInput } from './llm.types';

@Injectable()
export class LlmService {
    constructor(private readonly config: ConfigService) {}

    private requireConfig(key: string): string {
        const value = this.config.get<string>(key);

        if (!value) {
            throw new Error(`Missing required config: ${key}`);
        }

        return value;
    }

    async createLLM(): Promise<BaseChatModel> {
        const provider = this.requireConfig('llm.provider');
        const model = this.requireConfig('llm.model');

        let providerFields: Record<string, unknown>;
        let modelProvider = provider;

        if (provider === 'ollama') {
            providerFields = {
                baseUrl: this.config.get<string>('llm.baseUrl'),
                think: false,
            };
        } else if (provider === 'openrouter') {
            modelProvider = 'openai';
            providerFields = {
                apiKey: this.config.get<string>('llm.apiKey'),
                configuration: {
                    baseURL: 'https://openrouter.ai/api/v1',
                },
            };
        } else {
            providerFields = {
                apiKey: this.config.get<string>('llm.apiKey'),
            };
        }

        return initChatModel(model, {
            modelProvider,
            temperature: 0,
            streaming: false,
            ...providerFields,
        });
    }

    async createStreamingLLM(): Promise<BaseChatModel> {
        const provider = this.requireConfig('llm.provider');
        const model = this.requireConfig('llm.model');

        let providerFields: Record<string, unknown>;
        let modelProvider = provider;

        if (provider === 'ollama') {
            providerFields = {
                baseUrl: this.config.get<string>('llm.baseUrl'),
                think: false,
            };
        } else if (provider === 'openrouter') {
            modelProvider = 'openai';
            providerFields = {
                apiKey: this.config.get<string>('llm.apiKey'),
                configuration: {
                    baseURL: 'https://openrouter.ai/api/v1',
                },
            };
        } else {
            providerFields = {
                apiKey: this.config.get<string>('llm.apiKey'),
            };
        }

        return initChatModel(model, {
            modelProvider,
            temperature: 0,
            streaming: true,
            ...providerFields,
        });
    }

    async createToolModel(tools: StructuredTool[]): Promise<Runnable> {
        const llm = await this.createLLM();

        if (!llm.bindTools) {
            throw new Error(
                'The configured LLM provider does not support tool calling',
            );
        }

        return llm.bindTools(tools);
    }

    async createToolChain(
        config: ToolCallingChainConfig,
    ): Promise<Runnable<ToolChainInput, unknown>> {
        const llm = await this.createLLM();

        if (!llm.bindTools) {
            throw new Error(
                'The configured LLM provider does not support tool calling',
            );
        }

        const toolModel = llm.bindTools(config.tools);

        const toolMap = Object.fromEntries(
            config.tools.map((t) => [t.name, t]),
        );

        const chain = RunnableLambda.from(async (input: ToolChainInput) => {
            const messages = [...input.messages];

            for (let i = 0; i < (config.maxIterations ?? 3); i++) {
                const response = await toolModel.invoke(messages);
                messages.push(response);

                if (!response.tool_calls?.length) {
                    return response.content;
                }

                for (const call of response.tool_calls) {
                    const tool = toolMap[call.name];
                    if (!tool) throw new Error(`Unknown tool: ${call.name}`);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const result = await tool.invoke(
                        call.args as Record<string, unknown>,
                    );
                    messages.push(
                        new ToolMessage({
                            content: JSON.stringify(result),
                            tool_call_id: call.id!,
                        }),
                    );
                }
            }
            throw new Error('Tool calling exceeded max iterations');
        });

        return chain;
    }
}
