import { Injectable, OnModuleInit } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { InsightExtractionResult, InsightResultSchema } from './insight-schema';
import InsightExtractionPrompt from './insight-extraction-prompt';
import { InputMessage } from './types';
import { Insight } from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';

@Injectable()
export class InsightExtractionCapability implements OnModuleInit, ICapability {
    readonly name = 'insights-extractor';

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

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const messages: InputMessage[] = input.chunk.envelopes.map((env) => ({
            envolopId: env.envelope.id ?? '',
            type: env.payload.type,
            content: env.payload.content,
            groupId: env.payload.groupId,
            channelId: env.payload.channelId,
            authorId: env.envelope.authorId,
            hasAttachment: env.envelope.hasAttachment,
            replyTo: env.payload.replyTo,
            reactions: env.payload.reactions,
            pinned: env.payload.pinned,
            editedDate: env.payload.editedDate?.toISOString() ?? null,
            entities: env.payload.entities,
        }));

        const history = input.previousIntelligence;

        let result: InsightExtractionResult;
        try {
            result = await this.chain.invoke({
                history: JSON.stringify(history),
                messages: JSON.stringify(messages),
            });
        } catch (error) {
            throw new Error('insights extraction failed after 3 attempts', {
                cause: error,
            });
        }

        const insights: Insight[] = [
            ...result.updatedInsights.map((u) => ({
                id: u.id,
                type: u.type,
                content: u.content,
                owners: u.owners,
                envolopsRef: u.envolopsRef,
                broadcasted: u.broadcasted,
            })),
            ...result.newInsights.map((n) => ({
                id: null,
                type: n.type,
                content: n.content,
                owners: n.owners,
                envolopsRef: n.envolopsRef,
                broadcasted: n.broadcasted,
            })),
        ];

        return { capabilityName: this.name, insights };
    }
}
