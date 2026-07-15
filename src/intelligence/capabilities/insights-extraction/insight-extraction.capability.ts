import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { distance } from 'fastest-levenshtein';
import {
    InsightExtractionResult,
    InsightResultSchema,
    OwnerRef,
} from './insight-schema';
import { SYSTEM_PROMPT } from './insight-extraction-prompt';
import { InputMessage } from './types';
import { Insight, UnresolvedOwnerRef } from 'src/types/insight.types';
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

        this.logger.log(
            `Extracting insights: ${messages.length} envelopes, plugin=${pluginName}`,
        );

        const history = input.previousIntelligence;
        const llm = await this.llmService.createLLM();

        const chainInput = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Current insights:\n${JSON.stringify(history)}\nNew messages:\n${JSON.stringify(messages)}`,
            ),
        ];

        const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10);
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
                this.logger.debug(
                    `LLM returned ${result.updatedInsights.length} updated, ${result.newInsights.length} new insights`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `LLM invocation failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`,
                );
                if (attempt === MAX_RETRIES) {
                    throw new Error(
                        `insights extraction failed: ${error.message}`,
                    );
                }
            }
        }

        const firstEnv = input.chunk.envelopes[0];
        const chunkSourcePlugin = firstEnv?.envelope.sourcePlugin;
        const chunkGroupId = firstEnv?.payload.groupId ?? undefined;
        const chunkChannelId = firstEnv?.payload.channelId ?? undefined;
        const chunkTopicId = firstEnv?.payload.topicId ?? undefined;

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

        const resolveOwners = (
            owners: OwnerRef[],
        ): { resolved: string[]; unresolved: UnresolvedOwnerRef[] } => {
            const resolved: string[] = [];
            const unresolved: UnresolvedOwnerRef[] = [];
            for (const o of owners) {
                const appId = resolvedMap.get(JSON.stringify(o));
                if (appId) {
                    resolved.push(appId);
                } else {
                    unresolved.push({
                        platformUserId: o.id ?? null,
                        platformUsername: o.username ?? null,
                        pluginName,
                    });
                }
            }
            return { resolved, unresolved };
        };

        const insights: Insight[] = [
            ...result.updatedInsights.map((u) => {
                const { resolved, unresolved } = resolveOwners(u.owners);
                return {
                    id: u.id,
                    type: u.type,
                    content: u.content,
                    owners: resolved,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: u.envolopsRef,
                    broadcasted: u.broadcasted,
                    sourcePlugin: chunkSourcePlugin,
                    groupId: chunkGroupId,
                    channelId: chunkChannelId,
                    topicId: chunkTopicId,
                };
            }),
            ...result.newInsights.map((n) => {
                const { resolved, unresolved } = resolveOwners(n.owners);
                return {
                    id: null,
                    type: n.type,
                    content: n.content,
                    owners: resolved,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: n.envolopsRef,
                    broadcasted: n.broadcasted,
                    sourcePlugin: chunkSourcePlugin,
                    groupId: chunkGroupId,
                    channelId: chunkChannelId,
                    topicId: chunkTopicId,
                };
            }),
        ];

        this.logger.log(
            `Extraction complete: ${insights.length} insights (${insights.filter((i) => i.id === null).length} new, ${insights.filter((i) => i.id !== null).length} updates)`,
        );

        return { capabilityName: this.name, insights };
    }

    private async resolveOwnersBatch(
        allOwnerRefs: OwnerRef[],
        pluginName: string,
    ): Promise<Map<string, string | null>> {
        this.logger.debug(
            `Resolving ${allOwnerRefs.length} unique owner refs for plugin=${pluginName}`,
        );

        const allMappings =
            await this.platformUserMappingRepo.findWithUser(pluginName);

        const maxDistance = parseInt(
            process.env.OWNER_RESOLVER_MAX_DISTANCE ?? '1',
            10,
        );

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

            if (!appUserId && ref.username) {
                const query = ref.username.toLowerCase();
                let bestDistance = Infinity;
                let bestMatch: string | null = null;

                for (const m of allMappings) {
                    const firstName = m.user.firstName.toLowerCase();
                    const lastName = (m.user.lastName ?? '').toLowerCase();
                    const fullNameFL = `${firstName}${lastName}`;
                    const fullNameLF = `${lastName}${firstName}`;

                    const d = Math.min(
                        distance(query, firstName),
                        distance(query, lastName),
                        distance(query, fullNameFL),
                        distance(query, fullNameLF),
                    );

                    if (d < bestDistance) {
                        bestDistance = d;
                        bestMatch = m.appUserId;
                    }
                }

                if (bestDistance <= maxDistance && bestMatch) {
                    appUserId = bestMatch;
                    this.logger.debug(
                        `Fuzzy matched "${ref.username}" to distance ${bestDistance}`,
                    );
                }
            }

            if (!appUserId) {
                this.logger.warn(`Could not resolve owner: ${key}`);
            }

            results.set(key, appUserId);
        }

        const resolvedCount = [...results.values()].filter(
            (v) => v !== null,
        ).length;

        this.logger.debug(
            `Owner resolution complete: ${resolvedCount}/${allOwnerRefs.length} resolved`,
        );

        return results;
    }
}
