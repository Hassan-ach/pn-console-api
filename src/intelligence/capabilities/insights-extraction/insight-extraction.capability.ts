import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { InsightExtractionResult, InsightResultSchema } from './insight-schema';
import { SYSTEM_PROMPT } from './insight-extraction-prompt';
import { InputMessage } from './types';
import { Insight } from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';
import { RESOLVE_USERS_TOOL } from '../../tools/tools.module';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';

@Injectable()
export class InsightExtractionCapability implements OnModuleInit, ICapability {
    readonly name = 'insights-extractor';

    private chain: Runnable;

    constructor(
        private readonly llmService: LlmService,
        @Inject(RESOLVE_USERS_TOOL)
        private readonly resolveUsersTool: StructuredTool,
    ) {}

    async onModuleInit() {
        this.chain = await this.llmService.createToolChain({
            tools: [this.resolveUsersTool],
            maxIterations: 3,
        });
    }

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const messages: InputMessage[] = input.chunk.envelopes.map((env) => ({
            envolopId: env.envelope.id ?? '',
            sourcePlugin: env.envelope.sourcePlugin,
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
        const chainInput = {
            messages: [
                new SystemMessage(SYSTEM_PROMPT),
                new HumanMessage(
                    `Current insights:\n${JSON.stringify(history)}\nNew messages:\n${JSON.stringify(messages)}`,
                ),
            ],
        };

        const MAX_RETRIES = 3;
        let result: InsightExtractionResult = {
            updatedInsights: [],
            newInsights: [],
        };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const raw = (await this.chain.invoke(chainInput)) as string;
                result = InsightResultSchema.parse(JSON.parse(raw));
                break;
            } catch (error) {
                if (attempt === MAX_RETRIES) {
                    throw new Error(
                        `insights extraction failed: ${error.message}`,
                    );
                }
            }
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
