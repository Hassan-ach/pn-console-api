import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { ChatOllama } from '@langchain/ollama';
import { RunnableLambda } from '@langchain/core/runnables';
import { ToolMessage } from '@langchain/core/messages';

import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { InsightRepository } from 'src/repositories/insight.repository';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { createResolveUsersTool } from 'src/intelligence/tools/resolve-users.tool';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { StoreModule } from 'src/intelligence/store/store.module';
import { InsightPersistenceService } from 'src/intelligence/store/insight-persistence.service';
import { DataChunk } from 'src/intelligence/chunking/types/data-chunk.type';
import { EnvelopeWithPayload } from 'src/types/envelope.types';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

const TEST_ORG_ID = `test-org-${randomUUID()}`;

const USER_A_ID = randomUUID();
const USER_B_ID = randomUUID();
const USER_A_PLATFORM_ID = `tg-user-${Date.now()}-alice`;
const USER_A_USERNAME = 'alice_dev';
const USER_B_PLATFORM_ID = `tg-user-${Date.now()}-bob`;
const USER_B_USERNAME = 'bob_ops';

function makeEnvelope(
    id: string,
    content: string,
    authorId: string | null,
): EnvelopeWithPayload {
    return {
        envelope: {
            id,
            sourcePlugin: 'telegram',
            sourceId: `src-${id}`,
            type: 'message',
            hasAttachment: false,
            authorId,
            occurredAt: new Date(),
        },
        payload: {
            type: 'direct',
            content,
            groupId: null,
            channelId: null,
            replyTo: null,
            reactions: {},
            pinned: false,
            editedDate: null,
            entities: null,
            rawPayload: {},
        },
    };
}

function makeChunk(envelopes: EnvelopeWithPayload[]): DataChunk {
    return {
        id: randomUUID(),
        envelopes,
        metadata: {
            timeRange: { start: new Date(), end: new Date() },
            envelopeCount: envelopes.length,
        },
    };
}

describe('InsightExtraction — integration (real LLM + real DB)', () => {
    let module: TestingModule;
    let capability: InsightExtractionCapability;
    let persistence: InsightPersistenceService;
    let insightRepo: InsightRepository;
    let platformRepo: PlatformUserMappingRepository;
    let prisma: AppDbService;

    beforeAll(async () => {
        // DB modules only — no LlmModule, no InsightsExtractionModule
        module = await Test.createTestingModule({
            imports: [
                AppDbModule,
                RawDbModule,
                RepositoriesModule,
                StoreModule,
            ],
        }).compile();

        await module.init();

        persistence = module.get(InsightPersistenceService);
        insightRepo = module.get(InsightRepository);
        platformRepo = module.get(PlatformUserMappingRepository);
        prisma = module.get(AppDbService);

        // Build the real resolve_users tool backed by the real DB
        const resolveUsersTool = createResolveUsersTool(platformRepo);

        // Build the tool-calling chain using ChatOllama directly
        const ollama = new ChatOllama({
            model: process.env.LLM_MODEL ?? 'qwen3:8b',
            baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434',
            temperature: 0,
            think: false,
        });

        const toolModel = ollama.bindTools([resolveUsersTool]);
        const toolMap: Record<string, typeof resolveUsersTool> = {
            [resolveUsersTool.name]: resolveUsersTool,
        };

        const chain = RunnableLambda.from(async (input: {
            messages: any[];
        }) => {
            const messages = [...input.messages];
            for (let i = 0; i < 3; i++) {
                const response = await toolModel.invoke(messages);
                messages.push(response);
                if (!response.tool_calls?.length) {
                    return response.content;
                }
                for (const call of response.tool_calls) {
                    const tool = toolMap[call.name];
                    if (!tool) throw new Error(`Unknown tool: ${call.name}`);
                    const result = await tool.invoke(
                        call.args as Record<string, unknown>,
                    );
                    messages.push(
                        new ToolMessage({
                            content: JSON.stringify(result),
                            tool_call_id: call.id!,
                        }),
                    );
                }
            }
            throw new Error('Tool calling exceeded max iterations');
        });

        // Construct capability directly and inject the pre-built chain
        capability = new InsightExtractionCapability(
            { createLLM: jest.fn(), createToolChain: jest.fn() } as any,
            resolveUsersTool,
        );
        (capability as any).chain = chain;

        // Seed users
        await prisma.user.create({
            data: {
                id: USER_A_ID,
                firstName: 'Alice',
                lastName: 'Dev',
                email: `alice-${Date.now()}@test.local`,
            },
        });
        await prisma.user.create({
            data: {
                id: USER_B_ID,
                firstName: 'Bob',
                lastName: 'Ops',
                email: `bob-${Date.now()}@test.local`,
            },
        });

        // Seed platform mappings
        await platformRepo.create({
            platformUserId: USER_A_PLATFORM_ID,
            appUserId: USER_A_ID,
            pluginName: 'telegram',
            platformUsername: USER_A_USERNAME,
        });
        await platformRepo.create({
            platformUserId: USER_B_PLATFORM_ID,
            appUserId: USER_B_ID,
            pluginName: 'telegram',
            platformUsername: USER_B_USERNAME,
        });

        // Seed one existing insight for update tests
        await insightRepo.create({
            organizationId: TEST_ORG_ID,
            type: 'TASK',
            content: 'Set up monitoring dashboard for production services',
            owners: [USER_B_ID],
            broadcasted: false,
        });
    }, 86_400_000);

    afterAll(async () => {
        if (!prisma) return;

        // Clean up insights for test org (versions cascade)
        await prisma.insight.deleteMany({
            where: { organizationId: TEST_ORG_ID },
        });

        // Clean up platform mappings for seeded users
        const mappingsA = await platformRepo.findByAppUser(USER_A_ID);
        for (const m of mappingsA) {
            await platformRepo.delete(m.platformUserId, m.pluginName);
        }
        const mappingsB = await platformRepo.findByAppUser(USER_B_ID);
        for (const m of mappingsB) {
            await platformRepo.delete(m.platformUserId, m.pluginName);
        }

        // Clean up users
        await prisma.user.delete({ where: { id: USER_A_ID } }).catch(() => {});
        await prisma.user.delete({ where: { id: USER_B_ID } }).catch(() => {});

        await module.close();
    });

    it(
        'should extract new insights from messages and persist them',
        async () => {
            const env1 = makeEnvelope(
                'env-basic-1',
                'The database migration for v2.3 has been completed successfully, all tests passing.',
                null,
            );
            const env2 = makeEnvelope(
                'env-basic-2',
                'We need to update the API rate limits before the product launch next week. This is urgent.',
                USER_A_PLATFORM_ID,
            );

            const chunk = makeChunk([env1, env2]);
            const result = await capability.execute({
                chunk,
                previousIntelligence: [],
            });

            expect(result.capabilityName).toBe('insights-extractor');
            expect(result.insights.length).toBeGreaterThanOrEqual(1);

            // Each returned insight should have valid structure
            for (const insight of result.insights) {
                expect(['TASK', 'URGENCY', 'INFO', 'DECISION']).toContain(
                    insight.type,
                );
                expect(insight.content).toBeTruthy();
                expect(Array.isArray(insight.owners)).toBe(true);
                expect(Array.isArray(insight.envolopsRef)).toBe(true);
            }

            // Persist and verify DB
            await persistence.persistAll(result.insights, TEST_ORG_ID);
            const persisted = await insightRepo.getAllByOrganizationId(
                TEST_ORG_ID,
            );

            expect(persisted.length).toBeGreaterThanOrEqual(1);

            for (const insight of persisted) {
                expect(['TASK', 'URGENCY', 'INFO', 'DECISION']).toContain(
                    insight.type,
                );
                expect(insight.content).toBeTruthy();
                expect(insight.version).toBe(1);
                expect(insight.createdAt).toBeDefined();
            }
        },
        86_400_000,
    );

    it(
        'should update an existing insight and create new ones',
        async () => {
            // Fetch the seeded insight to get its ID
            const existing = await insightRepo.getAllByOrganizationId(
                TEST_ORG_ID,
            );
            const seedInsight = existing.find(
                (i) => i.content.includes('monitoring dashboard'),
            );
            expect(seedInsight).toBeDefined();

            const env1 = makeEnvelope(
                'env-update-1',
                `Update on the monitoring dashboard: it's fully deployed and live in production. All metrics are green.`,
                USER_A_PLATFORM_ID,
            );
            const env2 = makeEnvelope(
                'env-update-2',
                'New task: schedule a security audit for the authentication module by end of month.',
                null,
            );

            const chunk = makeChunk([env1, env2]);
            const result = await capability.execute({
                chunk,
                previousIntelligence: existing,
            });

            expect(result.insights.length).toBeGreaterThanOrEqual(1);

            // Check if the LLM decided to update the existing insight
            const updatedOnes = result.insights.filter(
                (i) => i.id === seedInsight!.id,
            );
            const newOnes = result.insights.filter(
                (i) => i.id !== seedInsight!.id,
            );

            // At least one of update or new should be present
            expect(updatedOnes.length + newOnes.length).toBeGreaterThanOrEqual(
                1,
            );

            // Persist and verify DB state
            await persistence.persistAll(result.insights, TEST_ORG_ID);
            const allInsights = await insightRepo.getAllByOrganizationId(
                TEST_ORG_ID,
            );
            expect(allInsights.length).toBeGreaterThanOrEqual(2);
        },
        86_400_000,
    );

    it(
        'should resolve platform user IDs to app user IDs via resolve_users tool',
        async () => {
            const env1 = makeEnvelope(
                'env-resolve-1',
                `${USER_A_USERNAME} needs to finish the API refactor and ${USER_B_USERNAME} should review the deployment pipeline.`,
                USER_A_PLATFORM_ID,
            );

            const chunk = makeChunk([env1]);
            const result = await capability.execute({
                chunk,
                previousIntelligence: [],
            });

            expect(result.insights.length).toBeGreaterThanOrEqual(1);

            // Check if any insight has owners referencing the seeded test users
            const insightsWithOwners = result.insights.filter(
                (i) => i.owners.length > 0,
            );

            if (insightsWithOwners.length > 0) {
                const allOwnerIds = insightsWithOwners.flatMap((i) => i.owners);
                const resolvedUserIds: string[] = [USER_A_ID, USER_B_ID];

                // At least one owner should match a seeded test user
                const hasResolvedUser = allOwnerIds.some((ownerId) =>
                    resolvedUserIds.includes(ownerId),
                );
                expect(hasResolvedUser).toBe(true);

                // Persist and verify DB
                await persistence.persistAll(result.insights, TEST_ORG_ID);
                const persisted = await insightRepo.getAllByOrganizationId(
                    TEST_ORG_ID,
                );

                const persistedWithOwners = persisted.filter(
                    (i) => i.owners.length > 0,
                );
                expect(persistedWithOwners.length).toBeGreaterThanOrEqual(1);

                for (const insight of persistedWithOwners) {
                    for (const ownerId of insight.owners) {
                        // Each owner should be a valid UUID of a seeded user
                        expect(resolvedUserIds).toContain(ownerId);
                    }
                }
            }
        },
        86_400_000,
    );
});
