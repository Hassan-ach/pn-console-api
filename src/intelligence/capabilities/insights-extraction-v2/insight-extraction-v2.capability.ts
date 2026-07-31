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
import {
    Insight,
    UnresolvedOwnerRef,
    InsightBroadcastLevel,
} from 'src/types/insight.types';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import { SearchToolsService } from '../../tools/search-tools.service';
import {
    PlatformUserMappingRepository,
    PlatformUserMappingWithUser,
} from 'src/repositories/platform-user-mapping.repository';
import { UserRepository, UserRecord } from 'src/repositories/user.repository';
import { EntityRepository } from 'src/repositories/entity.repository';
import { OrgStructureRepository } from 'src/repositories/org-structure.repository';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';

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

    // Try extracting markdown ```json ... ``` codeblock
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

    // Try extracting substring between first '{' and last '}'
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return str.substring(firstBrace, lastBrace + 1).trim();
    }

    return str.trim();
}

@Injectable()
export class InsightExtractionCapabilityV2 implements ICapability {
    readonly name = 'insights-extractor-v2';

    private readonly logger = new Logger(InsightExtractionCapabilityV2.name);

    constructor(
        private readonly llmService: LlmService,
        private readonly graphToolsService: GraphToolsService,
        private readonly searchToolsService: SearchToolsService,
        private readonly platformUserMappingRepo: PlatformUserMappingRepository,
        private readonly userRepo: UserRepository,
        private readonly entityRepo: EntityRepository,
        private readonly orgStructureRepository: OrgStructureRepository,
    ) {}

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const envelopes = input.chunk.envelopes;
        if (!envelopes || envelopes.length === 0) {
            return { capabilityName: this.name, insights: [] };
        }

        const messages: InputMessage[] = envelopes.map((env) => ({
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
            occurredAt: env.envelope.occurredAt.toISOString(),
            editedDate: env.payload.editedDate?.toISOString() ?? null,
            entities: env.payload.entities,
        }));

        const pluginName = messages[0]?.sourcePlugin ?? 'unknown';
        const orgId =
            input.chunk.envelopes[0]?.envelope.organizationId ?? 'org-1';

        this.logger.log(
            `[V2] Extracting insights with Knowledge Graph & Search tools: ${messages.length} envelopes, plugin=${pluginName} (orgId=${orgId})`,
        );

        const [allMappings, allOrgUsers] = await Promise.all([
            this.platformUserMappingRepo.findWithUser(pluginName),
            this.userRepo.findByOrganization(orgId),
        ]);

        const platformToAppUser = new Map<string, string>();
        for (const m of allMappings) {
            platformToAppUser.set(m.platformUserId, m.appUserId);
        }

        const msgAuthors = new Map<string, string | null>();
        for (const msg of messages) {
            msgAuthors.set(msg.envolopId, msg.authorId);
        }

        const history = input.previousIntelligence;
        const graphTools = this.graphToolsService.getTools(orgId);
        const searchTools = this.searchToolsService.getTools(orgId);
        const tools = [...graphTools, ...searchTools];

        const currentDate = new Date().toISOString().split('T')[0];

        const maxIterations = parseInt(
            process.env.LLM_MAX_TOOL_ITERATIONS ?? '15',
            10,
        );

        const chain = await this.llmService.createToolChain({
            tools,
            maxIterations,
        });

        const orgContext = await this.buildOrgContext(input.organizationId);

        const chainInput = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Current date: ${currentDate}\n\nCurrent insights:\n${JSON.stringify(history)}\nNew messages:\n${JSON.stringify(messages)}${orgContext}`,
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
                const cleanedJson = extractJsonString(responseContent);

                result = InsightResultSchema.parse(JSON.parse(cleanedJson));
                this.logger.debug(
                    `[V2] LLM returned ${result.updatedInsights.length} updated, ${result.newInsights.length} new insights`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `[V2] LLM invocation failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as Error).message}`,
                );
                if (attempt === MAX_RETRIES) {
                    this.logger.error(
                        `[V2] Insights extraction V2 failed after ${MAX_RETRIES} attempts: ${(error as Error).message}`,
                        (error as Error).stack,
                    );
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
                ? await this.resolveOwnersBatch(
                      allOwnerRefs,
                      allMappings,
                      allOrgUsers,
                      orgId,
                  )
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

        const resolveBroadcastLevel = (item: {
            broadcasted: boolean;
            broadcastLevel?: InsightBroadcastLevel;
        }): InsightBroadcastLevel =>
            item.broadcastLevel ??
            (item.broadcasted
                ? InsightBroadcastLevel.ORG
                : InsightBroadcastLevel.DIRECT);

        const insights: Insight[] = [
            ...result.updatedInsights.map((u) => {
                const { resolved, unresolved } = resolveOwners(u.owners);
                const excludedUserIds = u.excludeAuthor
                    ? getExcludedUserIds(u.envolopsRef)
                    : [];
                const filteredOwners = resolved.filter(
                    (id) => !excludedUserIds.includes(id),
                );
                const broadcastLevel = resolveBroadcastLevel(u);
                const isBroadcasted =
                    broadcastLevel === InsightBroadcastLevel.ORG;
                const broadcastTarget =
                    broadcastLevel === InsightBroadcastLevel.TEAM ||
                    broadcastLevel === InsightBroadcastLevel.ROLE
                        ? u.broadcastTarget
                        : undefined;

                return {
                    id: u.id,
                    type: u.type,
                    content: u.content,
                    owners: filteredOwners,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: u.envolopsRef,
                    broadcasted: isBroadcasted,
                    broadcastLevel,
                    broadcastTarget,
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
                const broadcastLevel = resolveBroadcastLevel(n);
                const isBroadcasted =
                    broadcastLevel === InsightBroadcastLevel.ORG;
                const broadcastTarget =
                    broadcastLevel === InsightBroadcastLevel.TEAM ||
                    broadcastLevel === InsightBroadcastLevel.ROLE
                        ? n.broadcastTarget
                        : undefined;

                return {
                    id: null,
                    type: n.type,
                    content: n.content,
                    owners: filteredOwners,
                    unresolvedOwnerRefs: unresolved,
                    envolopsRef: n.envolopsRef,
                    broadcasted: isBroadcasted,
                    broadcastLevel,
                    broadcastTarget,
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

    private async buildOrgContext(organizationId?: string): Promise<string> {
        if (!organizationId) return '';

        try {
            const [teams, roles] = await Promise.all([
                this.orgStructureRepository.findTeamsByOrganization(
                    organizationId,
                ),
                this.orgStructureRepository.findRolesByOrganization(
                    organizationId,
                ),
            ]);

            return `\n\nOrganization teams:\n${JSON.stringify(teams.map((t) => t.name))}\nOrganization roles:\n${JSON.stringify(roles.map((r) => r.name))}`;
        } catch (error) {
            this.logger.warn(
                `[V2] Failed to load org structure for context: ${(error as Error).message}`,
            );
            return '';
        }
    }

    private async resolveOwnersBatch(
        allOwnerRefs: OwnerRef[],
        allMappings: PlatformUserMappingWithUser[],
        allOrgUsers: UserRecord[],
        organizationId: string,
    ): Promise<Map<string, string | null>> {
        const maxDistance = parseInt(
            process.env.OWNER_RESOLVER_MAX_DISTANCE ?? '1',
            10,
        );

        const results = new Map<string, string | null>();

        for (const ref of allOwnerRefs) {
            const key = JSON.stringify(ref);
            if (results.has(key)) continue;

            let appUserId: string | null = null;

            // Tier 1: Check PlatformUserMapping by ID
            if (ref.id) {
                const mapping = allMappings.find(
                    (m) => m.platformUserId === ref.id,
                );
                if (mapping) {
                    appUserId = mapping.appUserId;
                }
            }

            // Tier 2: Check PlatformUserMapping by username
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

            // Tier 3: Knowledge Graph Entity Lookup (Person/Team entity with role metadata)
            if (!appUserId && (ref.username || ref.id)) {
                const searchTerm = (ref.username || ref.id || '').toLowerCase();
                try {
                    const kgEntities = await this.entityRepo.search(
                        organizationId,
                        searchTerm,
                        'Person',
                    );
                    if (kgEntities.length > 0) {
                        const matchedPerson = kgEntities[0];
                        // Try matching Person entity name to app users
                        const userMatch = allOrgUsers.find((u) =>
                            `${u.firstName} ${u.lastName ?? ''}`
                                .toLowerCase()
                                .includes(matchedPerson.name.toLowerCase()),
                        );
                        if (userMatch) {
                            appUserId = userMatch.id;
                        }
                    }
                } catch {
                    // non-fatal fallback
                }
            }

            // Tier 4: Fuzzy match against PlatformUserMapping user names
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

            // Tier 5: Direct/fuzzy match against Organization Users
            if (!appUserId && (ref.id || ref.username)) {
                const query = (ref.username || ref.id || '').toLowerCase();

                // Exact match by user.id, email, or email username
                const exactUser = allOrgUsers.find(
                    (u) =>
                        u.id === ref.id ||
                        u.email.toLowerCase() === query ||
                        u.email.split('@')[0].toLowerCase() === query ||
                        u.firstName.toLowerCase() === query ||
                        (u.lastName && u.lastName.toLowerCase() === query),
                );

                if (exactUser) {
                    appUserId = exactUser.id;
                } else if (query) {
                    let bestDistance = Infinity;
                    let bestMatch: string | null = null;

                    for (const u of allOrgUsers) {
                        const firstName = u.firstName.toLowerCase();
                        const lastName = (u.lastName ?? '').toLowerCase();
                        const emailUser = u.email.split('@')[0].toLowerCase();

                        const d = Math.min(
                            distance(query, firstName),
                            distance(query, lastName),
                            distance(query, emailUser),
                        );

                        if (d < bestDistance) {
                            bestDistance = d;
                            bestMatch = u.id;
                        }
                    }

                    if (bestDistance <= maxDistance && bestMatch) {
                        appUserId = bestMatch;
                    }
                }
            }

            results.set(key, appUserId);
        }

        return results;
    }
}
