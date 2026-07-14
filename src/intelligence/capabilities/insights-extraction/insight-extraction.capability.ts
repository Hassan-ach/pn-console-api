import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { InsightExtractionResult, InsightResultSchema, OwnerRef } from './insight-schema';
import { SYSTEM_PROMPT } from './insight-extraction-prompt';
import { InputMessage } from './types';
import { Insight } from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';

@Injectable()
export class InsightExtractionCapability implements ICapability {
    readonly name = 'insights-extractor';

    private readonly logger = new Logger(InsightExtractionCapability.name);

    constructor(
        private readonly llmService: LlmService,
        private readonly platformUserMappingRepo: PlatformUserMappingRepository,
    ) {}

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

        const pluginName = messages[0]?.sourcePlugin ?? 'unknown';

        const history = input.previousIntelligence;
        const llm = await this.llmService.createLLM();

        const chainInput = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Current insights:\n${JSON.stringify(history)}\nNew messages:\n${JSON.stringify(messages)}`,
            ),
        ];

        const MAX_RETRIES = 3;
        let result: InsightExtractionResult = {
            updatedInsights: [],
            newInsights: [],
        };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await llm.invoke(chainInput);
                result = InsightResultSchema.parse(
                    JSON.parse(response.content as string),
                );
                break;
            } catch (error) {
                if (attempt === MAX_RETRIES) {
                    throw new Error(
                        `insights extraction failed: ${error.message}`,
                    );
                }
            }
        }

        const allRawInsights = [
            ...result.updatedInsights,
            ...result.newInsights,
        ];

        const allOwnerRefs = [
            ...new Map(
                allRawInsights
                    .flatMap((i) => i.owners)
                    .map((o) => [JSON.stringify(o), o]),
            ).values(),
        ];

        const resolvedMap =
            allOwnerRefs.length > 0
                ? await this.resolveOwnersBatch(allOwnerRefs, pluginName)
                : new Map<string, string | null>();

        const resolveOwners = (owners: OwnerRef[]): string[] =>
            owners
                .map((o) => resolvedMap.get(JSON.stringify(o)))
                .filter((id): id is string => id !== null && id !== undefined);

        const insights: Insight[] = [
            ...result.updatedInsights.map((u) => ({
                id: u.id,
                type: u.type,
                content: u.content,
                owners: resolveOwners(u.owners),
                envolopsRef: u.envolopsRef,
                broadcasted: u.broadcasted,
            })),
            ...result.newInsights.map((n) => ({
                id: null,
                type: n.type,
                content: n.content,
                owners: resolveOwners(n.owners),
                envolopsRef: n.envolopsRef,
                broadcasted: n.broadcasted,
            })),
        ];

        return { capabilityName: this.name, insights };
    }

    //TODO: improve error handling for unresolvable users — currently silently skipped
    private async resolveOwnersBatch(
        allOwnerRefs: OwnerRef[],
        pluginName: string,
    ): Promise<Map<string, string | null>> {
        const allMappings =
            await this.platformUserMappingRepo.findByPluginName(pluginName);

        const results = new Map<string, string | null>();

        for (const ref of allOwnerRefs) {
            const key = JSON.stringify(ref);
            if (results.has(key)) continue;

            let appUserId: string | null = null;

            if (ref.id) {
                const mapping = allMappings.find(
                    (m) => m.platformUserId === ref.id,
                );
                if (mapping) {
                    appUserId = mapping.appUserId;
                }
            }

            if (!appUserId && ref.username) {
                const match = allMappings.find(
                    (m) =>
                        m.platformUsername.toLowerCase() ===
                        ref.username!.toLowerCase(),
                );
                if (match) {
                    appUserId = match.appUserId;
                }
            }

            results.set(key, appUserId);
        }

        return results;
    }
}
