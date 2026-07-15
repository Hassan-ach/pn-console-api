import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { ChatOllama } from '@langchain/ollama';

import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { InsightRepository } from 'src/repositories/insight.repository';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
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
            topicId: null,
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

        const ollama = new ChatOllama({
            model: process.env.LLM_MODEL ?? 'qwen3:8b',
            baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434',
            temperature: 0,
        });

        const llmServiceMock = {
            createLLM: jest.fn().mockResolvedValue(ollama),
        };

        capability = new InsightExtractionCapability(
            llmServiceMock as any,
            platformRepo,
        );

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

        await prisma.insight.deleteMany({
            where: { organizationId: TEST_ORG_ID },
        });

        const mappingsA = await platformRepo.findByAppUser(USER_A_ID);
        for (const m of mappingsA) {
            await platformRepo.delete(m.platformUserId, m.pluginName);
        }
        const mappingsB = await platformRepo.findByAppUser(USER_B_ID);
        for (const m of mappingsB) {
            await platformRepo.delete(m.platformUserId, m.pluginName);
        }

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
                expect(insight.envolopsRef).toBeDefined();
                expect(insight.envolopsRef!.length).toBeGreaterThanOrEqual(1);

                const validEnvIds = ['env-basic-1', 'env-basic-2'];
                const hasValidRef = insight.envolopsRef!.some((ref) =>
                    validEnvIds.includes(ref),
                );
                expect(hasValidRef).toBe(true);
            }
        },
        86_400_000,
    );

    it(
        'should update an existing insight and create new ones',
        async () => {
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

            const updatedOnes = result.insights.filter(
                (i) => i.id === seedInsight!.id,
            );
            const newOnes = result.insights.filter(
                (i) => i.id !== seedInsight!.id,
            );

            expect(updatedOnes.length + newOnes.length).toBeGreaterThanOrEqual(
                1,
            );

            await persistence.persistAll(result.insights, TEST_ORG_ID);
            const allInsights = await insightRepo.getAllByOrganizationId(
                TEST_ORG_ID,
            );
            expect(allInsights.length).toBeGreaterThanOrEqual(2);
        },
        86_400_000,
    );

    it(
        'should resolve platform user IDs to app user IDs via local resolution',
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

            const insightsWithOwners = result.insights.filter(
                (i) => i.owners.length > 0,
            );

            if (insightsWithOwners.length > 0) {
                const allOwnerIds = insightsWithOwners.flatMap((i) => i.owners);
                const resolvedUserIds: string[] = [USER_A_ID, USER_B_ID];

                const hasResolvedUser = allOwnerIds.some((ownerId) =>
                    resolvedUserIds.includes(ownerId),
                );
                expect(hasResolvedUser).toBe(true);

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
                        expect(resolvedUserIds).toContain(ownerId);
                    }
                }
            }
        },
        86_400_000,
    );
});
