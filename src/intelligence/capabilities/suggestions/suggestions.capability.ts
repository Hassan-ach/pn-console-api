import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import {
    InsightSuggestionRepository,
    CreateSuggestionInput,
} from 'src/repositories/insight-suggestion.repository';
import { SuggestionActionType } from 'generated/app-db-client';
import { SYSTEM_PROMPT } from './suggestions-prompt';
import {
    SuggestionsResultSchema,
    SuggestionsResult,
} from './suggestions-schema';

function extractJsonString(raw: unknown): string {
    let str = '';
    if (typeof raw === 'string') {
        str = raw;
    } else if (Array.isArray(raw)) {
        str = raw
            .map((item) =>
                typeof item === 'string' ? item : JSON.stringify(item),
            )
            .join('\n');
    } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (typeof obj.output === 'string') {
            str = obj.output;
        } else if (typeof obj.content === 'string') {
            str = obj.content;
        } else {
            str = JSON.stringify(raw);
        }
    }

    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim()) {
        const blockContent = codeBlockMatch[1].trim();
        const start = blockContent.indexOf('{');
        const end = blockContent.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return blockContent.substring(start, end + 1).trim();
        }
        return blockContent;
    }

    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return str.substring(firstBrace, lastBrace + 1).trim();
    }

    return str.trim();
}

@Injectable()
export class SuggestionsCapability implements ICapability {
    readonly name = 'suggestions-extractor';

    private readonly logger = new Logger(SuggestionsCapability.name);

    constructor(
        private readonly llmService: LlmService,
        private readonly graphToolsService: GraphToolsService,
        private readonly suggestionRepo: InsightSuggestionRepository,
    ) {}

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const envelopes = input.chunk.envelopes;
        if (!envelopes || envelopes.length === 0) {
            return { capabilityName: this.name, insights: [] };
        }

        const orgId = envelopes[0]?.envelope.organizationId ?? 'org-1';
        const history = input.previousIntelligence ?? [];

        if (history.length === 0) {
            this.logger.debug(
                'No insights in context; skipping suggestions extraction',
            );
            return { capabilityName: this.name, insights: [] };
        }

        this.logger.log(
            `Executing suggestions capability on ${history.length} insights (orgId: ${orgId})`,
        );

        const tools = this.graphToolsService.getTools(orgId);
        const maxIterations = parseInt(
            process.env.LLM_MAX_TOOL_ITERATIONS ?? '15',
            10,
        );

        const chain = await this.llmService.createToolChain({
            tools,
            maxIterations,
        });

        const chainInput = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Context Insights to analyze for suggestions:\n${JSON.stringify(history, null, 2)}`,
            ),
        ];

        const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10);
        let result: SuggestionsResult = { suggestions: [] };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const responseContent = await chain.invoke({
                    messages: chainInput,
                });
                const cleanedJson = extractJsonString(responseContent);
                result = SuggestionsResultSchema.parse(JSON.parse(cleanedJson));
                this.logger.debug(
                    `Suggestions capability generated ${result.suggestions.length} recommendations on attempt ${attempt}`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `Suggestions capability failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as Error).message}`,
                );
                if (attempt === MAX_RETRIES) {
                    this.logger.error(
                        `Suggestions capability failed after ${MAX_RETRIES} attempts`,
                    );
                }
            }
        }

        if (result.suggestions.length > 0) {
            const recordsToCreate: CreateSuggestionInput[] =
                result.suggestions.flatMap((s) => {
                    const contextSummary = s.contextSummary ?? [];
                    const options = s.options ?? [];

                    if (options.length > 0) {
                        return options.map((opt) => ({
                            insightId: s.insightId,
                            organizationId: orgId,
                            title: s.title || opt.title,
                            description: opt.description || opt.title,
                            actionType:
                                opt.actionType ??
                                SuggestionActionType.RECOMMENDATION,
                            reasoning: opt.reasoning,
                            metadata: {
                                contextSummary,
                                optionLabel: opt.label,
                                optionTitle: opt.title,
                                risk: opt.risk,
                            },
                        }));
                    }

                    return [
                        {
                            insightId: s.insightId,
                            organizationId: orgId,
                            title: s.title,
                            description: s.title,
                            actionType: SuggestionActionType.RECOMMENDATION,
                            reasoning: undefined,
                            metadata: {
                                contextSummary,
                                optionLabel: 'Option A',
                                optionTitle: s.title,
                                risk: undefined,
                            },
                        },
                    ];
                });

            await this.suggestionRepo.createMany(recordsToCreate);
            this.logger.log(
                `Persisted ${recordsToCreate.length} suggestions to database`,
            );
        }

        return { capabilityName: this.name, insights: [] };
    }
}
