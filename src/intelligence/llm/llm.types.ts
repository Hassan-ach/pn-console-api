import { StructuredTool } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ToolCallingChainConfig {
    tools: StructuredTool[];
    systemPrompt?: string;
    maxIterations?: number;
    model?: BaseChatModel;
}

export interface ToolChainInput {
    messages: BaseMessage[];
}

