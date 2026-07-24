/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InMemoryEnterpriseContextBuilder } from './in-memory-enterprise-context-builder';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';
import { AppDbService } from '../../../prisma/app-db/app-db.service';
import { WindowDiscoveryService } from '../services/window-discovery.service';

function mockConfig(
    overrides?: Record<string, unknown>,
): jest.Mocked<ConfigService> {
    const get: jest.Mock<unknown, [string, unknown?]> = jest.fn(
        (key: string, defaultValue?: unknown): unknown => {
            const values: Record<string, unknown> = {
                'context.defaultInsightLimit': 20,
                ...overrides,
            };
            return key in values ? values[key] : defaultValue;
        },
    );
    return { get } as unknown as jest.Mocked<ConfigService>;
}

describe('InMemoryEnterpriseContextBuilder', () => {
    let builder: InMemoryEnterpriseContextBuilder;
    let rawDb: jest.Mocked<RawDbService>;
    let appDb: jest.Mocked<AppDbService>;
    let windowDiscovery: jest.Mocked<WindowDiscoveryService>;

    const baseEnvelopeRow = {
        id: 'e1',
        sourcePlugin: 'telegram',
        sourceId: 's1',
        type: 'MESSAGE',
        hasAttachment: false,
        authorId: 'u1',
        occurredAt: new Date('2026-07-01T12:00:00Z'),
        organizationId: 'org-1',
        status: 'INGESTED',
        payload: {
            id: 'p1',
            type: 'DIRECT',
            content: 'hello',
            groupId: null,
            channelId: null,
            topicId: null,
            replyTo: null,
            reactions: {},
            pinned: false,
            editedDate: null,
            entities: null,
        },
    };

    beforeEach(async () => {
        rawDb = {
            envelope: {
                findMany: jest.fn(),
            },
        } as any;
        appDb = {
            insightVersion: {
                findMany: jest.fn(),
            },
        } as any;
        windowDiscovery = { discoverWindows: jest.fn() } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InMemoryEnterpriseContextBuilder,
                { provide: RawDbService, useValue: rawDb },
                { provide: AppDbService, useValue: appDb },
                { provide: WindowDiscoveryService, useValue: windowDiscovery },
                { provide: ConfigService, useValue: mockConfig() },
            ],
        }).compile();

        builder = module.get(InMemoryEnterpriseContextBuilder);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ── build() — envelopeIds path ──

    it('builds context from specific envelope IDs', async () => {
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1', {
            envelopeIds: ['e1'],
        })) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(1);
        expect(contexts[0].organizationId).toBe('org-1');
        expect(contexts[0].envelopes).toHaveLength(1);
        expect(contexts[0].envelopes[0].envelope.id).toBe('e1');
        expect(rawDb.envelope.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: { in: ['e1'] },
                }),
            }),
        );
    });

    it('builds context from multiple envelope IDs', async () => {
        const row2 = {
            ...baseEnvelopeRow,
            id: 'e2',
            occurredAt: new Date('2026-07-02T12:00:00Z'),
        };
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow, row2]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1', {
            envelopeIds: ['e1', 'e2'],
        })) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(1);
        expect(contexts[0].envelopes).toHaveLength(2);
    });

    // ── build() — windowStart/windowEnd path ──

    it('builds context from time window', async () => {
        const start = new Date('2026-07-01');
        const end = new Date('2026-07-31');
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1', {
            windowStart: start,
            windowEnd: end,
        })) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(1);
        expect(contexts[0].window.start).toEqual(start);
        expect(contexts[0].window.end).toEqual(end);
        expect(rawDb.envelope.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    occurredAt: expect.objectContaining({
                        gte: start,
                        lte: end,
                    }),
                }),
            }),
        );
    });

    it('builds context with only windowStart', async () => {
        const start = new Date('2026-07-01');
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1', {
            windowStart: start,
        })) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(1);
        expect(contexts[0].window.start).toEqual(start);
    });

    // ── build() — window discovery path ──

    it('builds contexts from discovered windows', async () => {
        const windows = [
            {
                start: new Date('2026-07-01'),
                end: new Date('2026-07-07T23:59:59.999Z'),
                messageCount: 100,
            },
            {
                start: new Date('2026-07-08'),
                end: new Date('2026-07-14T23:59:59.999Z'),
                messageCount: 200,
            },
        ];
        windowDiscovery.discoverWindows.mockResolvedValue(windows);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1', { minMessages: 50 })) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(2);
        expect(contexts[0].window.messageCount).toBe(100);
        expect(contexts[1].window.messageCount).toBe(200);
        expect(windowDiscovery.discoverWindows).toHaveBeenCalledWith('org-1', {
            minMessages: 50,
        });
    });

    it('yields nothing when no windows discovered', async () => {
        windowDiscovery.discoverWindows.mockResolvedValue([]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(0);
    });

    // ── build() — default path (fallback to window discovery) ──

    it('falls back to window discovery when no options given', async () => {
        windowDiscovery.discoverWindows.mockResolvedValue([]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            contexts.push(ctx);
        }

        expect(contexts).toHaveLength(0);
        expect(windowDiscovery.discoverWindows).toHaveBeenCalled();
    });

    // ── queryPreviousIntelligence — no scope (latest insights) ──

    it('loads latest insights when no scope provided', async () => {
        const createdAt = new Date('2026-07-01');
        appDb.insightVersion.findMany.mockResolvedValue([
            {
                insightId: 'i1',
                type: 'INFO',
                content: 'test',
                owners: [],
                envolopsRef: [],
                broadcasted: false,
                version: 1,
                createdAt,
                sourcePlugin: null,
                groupId: null,
                channelId: null,
                topicId: null,
                insight: { organizationId: 'org-1' },
            },
        ]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        let previousInsights: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            previousInsights = await ctx.previousIntelligence({ limit: 5 });
        }

        expect(previousInsights).toHaveLength(1);
        expect(previousInsights[0].id).toBe('i1');
        expect(appDb.insightVersion.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        );
    });

    it('uses default limit from config when not provided', async () => {
        appDb.insightVersion.findMany.mockResolvedValue([]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        for await (const ctx of builder.build('org-1')) {
            await ctx.previousIntelligence({});
        }

        expect(appDb.insightVersion.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 20 }),
        );
    });

    it('returns empty array when limit <= 0', async () => {
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        let previousInsights: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            previousInsights = await ctx.previousIntelligence({ limit: 0 });
        }

        expect(previousInsights).toEqual([]);
        expect(appDb.insightVersion.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when limit is negative', async () => {
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        let previousInsights: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            previousInsights = await ctx.previousIntelligence({ limit: -1 });
        }

        expect(previousInsights).toEqual([]);
        expect(appDb.insightVersion.findMany).not.toHaveBeenCalled();
    });

    // ── queryPreviousIntelligence — with scope ──

    it('queries with sourcePlugin scope only', async () => {
        appDb.insightVersion.findMany.mockResolvedValue([]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        for await (const ctx of builder.build('org-1')) {
            await ctx.previousIntelligence({
                scope: { sourcePlugin: 'telegram' },
            });
        }

        const callArgs = appDb.insightVersion.findMany.mock.calls[0][0];
        expect(callArgs.where.sourcePlugin).toBe('telegram');
    });

    it('queries with channelId and topicId scope', async () => {
        appDb.insightVersion.findMany.mockResolvedValue([]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        for await (const ctx of builder.build('org-1')) {
            await ctx.previousIntelligence({
                scope: {
                    sourcePlugin: 'telegram',
                    channelId: 'c1',
                    topicId: 't1',
                },
            });
        }

        const callArgs = appDb.insightVersion.findMany.mock.calls[0][0];
        expect(callArgs.where.channelId).toBe('c1');
        expect(callArgs.where.topicId).toBe('t1');
        expect(callArgs.where.groupId).toBeUndefined();
    });

    it('queries with groupId scope when no channel/topic', async () => {
        appDb.insightVersion.findMany.mockResolvedValue([]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        for await (const ctx of builder.build('org-1')) {
            await ctx.previousIntelligence({
                scope: {
                    sourcePlugin: 'telegram',
                    groupId: 'g1',
                },
            });
        }

        const callArgs = appDb.insightVersion.findMany.mock.calls[0][0];
        expect(callArgs.where.groupId).toBe('g1');
        expect(callArgs.where.channelId).toBeNull();
        expect(callArgs.where.topicId).toBeNull();
    });

    it('loadScopedInsights falls back to loadLatestInsights when scope has no sourcePlugin', async () => {
        appDb.insightVersion.findMany.mockResolvedValue([]);
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        for await (const ctx of builder.build('org-1')) {
            await ctx.previousIntelligence({
                scope: { groupId: 'g1' },
            });
        }

        const callArgs = appDb.insightVersion.findMany.mock.calls[0][0];
        // No sourcePlugin = loadLatestInsights path, no scope filter
        expect(callArgs.where.sourcePlugin).toBeUndefined();
    });

    // ── envelope status filter ──

    it('filters out READY envelopes', async () => {
        rawDb.envelope.findMany.mockResolvedValue([baseEnvelopeRow]);
        windowDiscovery.discoverWindows.mockResolvedValue([
            { start: new Date(), end: new Date(), messageCount: 1 },
        ]);

        const contexts: any[] = [];
        for await (const ctx of builder.build('org-1')) {
            contexts.push(ctx);
        }

        expect(rawDb.envelope.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: { not: 'READY' },
                }),
            }),
        );
    });
});
