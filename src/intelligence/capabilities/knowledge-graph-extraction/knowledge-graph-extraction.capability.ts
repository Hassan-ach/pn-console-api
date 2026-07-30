import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import { SYSTEM_PROMPT } from './kg-extraction-prompt';

@Injectable()
export class KnowledgeGraphExtractionCapability implements ICapability {
    readonly name = 'knowledge-graph-extractor';

    private readonly logger = new Logger(
        KnowledgeGraphExtractionCapability.name,
    );

    constructor(
        private readonly llmService: LlmService,
        private readonly graphToolsService: GraphToolsService,
    ) {}

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const envelopes = input.chunk.envelopes;
        if (!envelopes || envelopes.length === 0) {
            this.logger.debug('No envelopes in chunk; skipping KG extraction');
            return { capabilityName: this.name, insights: [] };
        }

        const messages = envelopes.map((env) => ({
            envelopeId: env.envelope.id ?? '',
            sourcePlugin: env.envelope.sourcePlugin,
            content: env.payload.content,
            authorId: env.envelope.authorId,
            groupId: env.payload.groupId,
            channelId: env.payload.channelId,
            topicId: env.payload.topicId,
            occurredAt: env.envelope.occurredAt?.toISOString() ?? null,
        }));

        const orgId = envelopes[0]?.envelope.organizationId ?? undefined;

        this.logger.log(
            `Executing agentic Knowledge Graph extraction on ${messages.length} envelopes (orgId: ${orgId ?? 'none'})`,
        );

        const tools = this.graphToolsService.getTools(orgId);
        const graphModel = await this.llmService.createGraphLLM();

        const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10);

        const chain = await this.llmService.createToolChain({
            tools,
            model: graphModel,
            maxIterations: 5,
        });

        const chainInputMessages = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Messages to analyze and mutate graph:\n${JSON.stringify(messages, null, 2)}`,
            ),
        ];

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await chain.invoke({ messages: chainInputMessages });
                this.logger.debug(
                    `Agentic KG extraction completed successfully on attempt ${attempt}`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `Agentic KG extraction failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as Error).message}`,
                );
                if (attempt === MAX_RETRIES) {
                    this.logger.error(
                        `Agentic KG extraction failed after ${MAX_RETRIES} attempts`,
                    );
                }
            }
        }

        return { capabilityName: this.name, insights: [] };
    }
}
