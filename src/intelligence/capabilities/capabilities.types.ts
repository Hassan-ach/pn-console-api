import { StructuredTool } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';

export interface ICapability {
  name: string;
  description: string;
  tools: StructuredTool[];
  chain: Runnable;
}
