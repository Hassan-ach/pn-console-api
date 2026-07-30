import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { distance } from 'fastest-levenshtein';
import {
    InsightExtractionResult,
    InsightResultSchema,
    OwnerRef,
} from '../insights-extraction/insight-schema';
import { SYSTEM_PROMPT } from './insight-extraction-v2-prompt';
import { InputMessage } from '../insights-extraction/types';
import { Insight, UnresolvedOwnerRef } from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import {
    PlatformUserMappingRepository,
    PlatformUserMappingWithUser,
} from 'src/repositories/platform-user-mapping.repository';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';

@Injectable()
export class InsightExtractionCapabilityV2 implements ICapability {
    readonly name = 'insights-extractor-v2';

    private readonly logger = new Logger(InsightExtractionCapabilityV2.name);

    constructor(
        private readonly llmService: LlmService,
        private readonly graphToolsService: GraphToolsService,
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
        const orgId =
            input.chunk.envelopes[0]?.envelope.organizationId ?? undefined;

        this.logger.log(
            `[V2] Extracting insights with Knowledge Graph tools: ${messages.length} envelopes, plugin=${pluginName}`,
        );

        const allMappings =
            await this.platformUserMappingRepo.findWithUser(pluginName);

        const platformToAppUser = new Map<string, string>();
        for (const m of allMappings) {
            platformToAppUser.set(m.platformUserId, m.appUserId);
        }

        const msgAuthors = new Map<string, string | null>();
        for (const msg of messages) {
            msgAuthors.set(msg.envolopId, msg.authorId);
        }

        const history = input.previousIntelligence;
        const tools = this.graphToolsService.getTools(orgId);
        const currentDate = new Date().toISOString().split('T')[0];

        const chain = await this.llmService.createToolChain({
            tools,
            maxIterations: 5,
        });

        const chainInput = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Current date: ${currentDate}\n\nCurrent insights:\n${JSON.stringify(history)}\nNew messages:\n${JSON.stringify(messages)}`,
            ),
        ];

        const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10);
        let result: InsightExtractionResult = {
            updatedInsights: [],
            newInsights: [],
        };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const responseContent = await chain.invoke({
                    messages: chainInput,
                });
                const rawString =
                    typeof responseContent === 'string'
                        ? responseContent
                        : JSON.stringify(responseContent);
                const cleaned = rawString
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

                result = InsightResultSchema.parse(JSON.parse(cleaned));
                this.logger.debug(
                    `[V2] LLM returned ${result.updatedInsights.length} updated, ${result.newInsights.length} new insights`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `[V2] LLM invocation failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as Error).message}`,
                );
                if (attempt === MAX_RETRIES) {
                    throw new Error(
                        `insights extraction V2 failed: ${(error as Error).message}`,
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
                ? this.resolveOwnersBatch(allOwnerRefs, allMappings)
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

        const getExcludedUserIds = (envolopsRef: string[]): string[] => {
            const excluded = new Set<string>();
            for (const ref of envolopsRef) {
                const platformAuthorId = msgAuthors.get(ref);
                if (platformAuthorId) {
                    const appUserId = platformToAppUser.get(platformAuthorId);
                    if (appUserId) {
                        excluded.add(appUserId);
                    }
                }
            }
            return [...excluded];
        };

        const insights: Insight[] = [
            ...result.updatedInsights.map((u) => {
                const { resolved, unresolved } = resolveOwners(u.owners);
                const excludedUserIds = u.excludeAuthor
                    ? getExcludedUserIds(u.envolopsRef)
                    : [];
                const filteredOwners = resolved.filter(
                    (id) => !excludedUserIds.includes(id),
                );
                const isBroadcasted =
                    u.broadcasted ||
                    (excludedUserIds.length > 0 && filteredOwners.length === 0);
                return {
                    id: u.id,
                    type: u.type,
                    content: u.content,
                    owners: filteredOwners,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: u.envolopsRef,
                    broadcasted: isBroadcasted,
                    excludedUserIds:
                        excludedUserIds.length > 0
                            ? excludedUserIds
                            : undefined,
                    priority: u.priority,
                    deadline: u.deadline ? new Date(u.deadline) : undefined,
                    sourcePlugin: chunkSourcePlugin,
                    groupId: chunkGroupId,
                    channelId: chunkChannelId,
                    topicId: chunkTopicId,
                };
            }),
            ...result.newInsights.map((n) => {
                const { resolved, unresolved } = resolveOwners(n.owners);
                const excludedUserIds = n.excludeAuthor
                    ? getExcludedUserIds(n.envolopsRef)
                    : [];
                const filteredOwners = resolved.filter(
                    (id) => !excludedUserIds.includes(id),
                );
                const isBroadcasted =
                    n.broadcasted ||
                    (excludedUserIds.length > 0 && filteredOwners.length === 0);
                return {
                    id: null,
                    type: n.type,
                    content: n.content,
                    owners: filteredOwners,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: n.envolopsRef,
                    broadcasted: isBroadcasted,
                    excludedUserIds:
                        excludedUserIds.length > 0
                            ? excludedUserIds
                            : undefined,
                    priority: n.priority,
                    deadline: n.deadline ? new Date(n.deadline) : undefined,
                    sourcePlugin: chunkSourcePlugin,
                    groupId: chunkGroupId,
                    channelId: chunkChannelId,
                    topicId: chunkTopicId,
                };
            }),
        ];

        this.logger.log(
            `[V2] Extraction complete: ${insights.length} insights`,
        );

        return { capabilityName: this.name, insights };
    }

    private resolveOwnersBatch(
        allOwnerRefs: OwnerRef[],
        allMappings: PlatformUserMappingWithUser[],
    ): Map<string, string | null> {
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
                }
            }

            results.set(key, appUserId);
        }

        return results;
    }
}
