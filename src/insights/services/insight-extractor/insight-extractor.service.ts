import { Injectable, OnModuleInit } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { InsightExtractionResult, InsightResultSchema } from './insight-schema';
import InsightExtractionPrompt from './insight-extraction-prompt';
import { InputInsight, InputMessage } from '../../types';
import { LlmService } from '../../../llm/llm.service';

@Injectable()
export class InsightExtractionService implements OnModuleInit {
  private chain: Runnable;

  constructor(private readonly llmService: LlmService) {}

  async onModuleInit() {
    const llm = await this.llmService.createLLM();
    const llmWithStructuredOutput =
      llm.withStructuredOutput(InsightResultSchema);

    this.chain = InsightExtractionPrompt.pipe(
      llmWithStructuredOutput,
    ).withRetry({
      stopAfterAttempt: 3,
    });
  }

  async extractInsights(
    history: InputInsight[],
    messages: InputMessage[],
  ): Promise<InsightExtractionResult> {
    try {
      return await this.chain.invoke({
        history: JSON.stringify(history),
        messages: JSON.stringify(messages),
      });
    } catch (error) {
      throw new Error('insights extraction failed after 3 attempts', {
        cause: error,
      });
    }
  }
}
