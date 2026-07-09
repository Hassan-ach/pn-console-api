import { Injectable, OnModuleInit } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { InsightExtractionResult, InsightResultSchema } from './insight-schema';
import InsightExtractionPrompt from './insight-extractor-prompt';
import { InputMessage } from './types';
import { Insight } from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class InsightExtractorService implements OnModuleInit {
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
    history: Insight[],
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
