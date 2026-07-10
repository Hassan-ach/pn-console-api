import { StructuredTool } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';

export interface ToolCallingChainConfig {
    tools: StructuredTool[];
    systemPrompt?: string;
    maxIterations?: number;
}

export interface ToolChainInput {
    messages: BaseMessage[];
}
