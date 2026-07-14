import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { IntelligenceEngineService } from './intelligence-engine.service';
import { EnterpriseContextBuilder } from './context/builders/enterprise-context-builder.abstract';
import { ChunkingPipeline } from './chunking/chunking-pipeline.service';
import { CapabilityManager } from './capabilities/capability-manager.service';
import { InsightPersistenceService } from './store/insight-persistence.service';
import type { EnterpriseContext, RetrievalWindow, PreviousIntelligenceQuery } from './context/types/enterprise-context.types';
import type { Insight } from '../types/insight.types';
import type { DataChunk } from './chunking/types/data-chunk.type';
import type { EnvelopeWithPayload } from '../types/envelope.types';

const basePayload = {
    id: 'p1',
    type: 'direct' as const,
    content: 'hello',
    groupId: null,
    channelId: null,
    topicId: null,
    replyTo: null,
    reactions: {},
    pinned: false,
    editedDate: null,
    entities: null,
    rawPayload: {},
};

const baseEnvelope: EnvelopeWithPayload = {
    envelope: {
        id: 'e1',
        sourcePlugin: 'telegram',
        sourceId: 's1',
        type: 'message',
        hasAttachment: false,
        authorId: 'u1',
        occurredAt: new Date(),
    },
    payload: { ...basePayload },
};

const baseChunk: DataChunk = {
    id: 'chunk-1',
    envelopes: [baseEnvelope],
    metadata: {
        timeRange: { start: new Date(), end: new Date() },
        envelopeCount: 1,
    },
};

const defaultWindow: RetrievalWindow = {
    start: new Date('2026-01-01'),
    end: new Date('2026-01-01'),
    messageCount: 0,
};

function makeContext(overrides?: {
    window?: RetrievalWindow;
    envelopes?: EnvelopeWithPayload[];
    previousIntelligence?: jest.Mock;
}): EnterpriseContext {
    return {
        organizationId: 'org-1',
        window: overrides?.window ?? defaultWindow,
        metadata: {},
        envelopes: overrides?.envelopes ?? [],
        previousIntelligence:
            overrides?.previousIntelligence ??
            jest.fn().mockResolvedValue([]),
    };
}

async function* singleCtx(ctx: EnterpriseContext): AsyncIterable<EnterpriseContext> {
    yield ctx;
}

async function* multiCtx(...contexts: EnterpriseContext[]): AsyncIterable<EnterpriseContext> {
    for (const ctx of contexts) {
        yield ctx;
    }
}

async function* noCtx(): AsyncIterable<EnterpriseContext> {
    return;
}

async function* singleChunk(chunk: DataChunk): AsyncIterable<DataChunk> {
    yield chunk;
}

async function* multiChunk(...chunks: DataChunk[]): AsyncIterable<DataChunk> {
    for (const c of chunks) {
        yield c;
    }
}

describe('IntelligenceEngineService', () => {
    let engine: IntelligenceEngineService;
    let mockContextBuilder: jest.Mocked<EnterpriseContextBuilder>;
    let mockPipeline: jest.Mocked<ChunkingPipeline>;
    let mockCapabilityManager: jest.Mocked<CapabilityManager>;
    let mockPersistence: jest.Mocked<InsightPersistenceService>;

    beforeEach(async () => {
        mockContextBuilder = {
            build: jest.fn(),
        } as any;

        mockPipeline = {
            run: jest.fn(),
        } as any;

        mockCapabilityManager = {
            executeAll: jest.fn(),
        } as any;

        mockPersistence = {
            persistAll: jest.fn().mockResolvedValue(undefined),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntelligenceEngineService,
                { provide: EnterpriseContextBuilder, useValue: mockContextBuilder },
                { provide: ChunkingPipeline, useValue: mockPipeline },
                { provide: CapabilityManager, useValue: mockCapabilityManager },
                { provide: InsightPersistenceService, useValue: mockPersistence },
            ],
        }).compile();

        engine = module.get(IntelligenceEngineService);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('builds context, chunks, executes capabilities, and persists results', async () => {
        const insight: Insight = { id: null, type: 'INFO', content: 'extracted', owners: [] };
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        const prevMock = ctx.previousIntelligence as jest.Mock;
        prevMock.mockResolvedValue([]);

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [insight] }],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockContextBuilder.build).toHaveBeenCalledWith('org-1', {
            envelopeIds: undefined,
            windowStart: undefined,
            windowEnd: undefined,
        });
        expect(mockPipeline.run).toHaveBeenCalledWith([baseEnvelope]);
        expect(prevMock).toHaveBeenCalledWith({
            scope: { sourcePlugin: 'telegram' },
            limit: 5,
        });
        expect(mockCapabilityManager.executeAll).toHaveBeenCalledWith({
            chunk: baseChunk,
            previousIntelligence: [],
        });
        expect(mockPersistence.persistAll).toHaveBeenCalledWith([insight], 'org-1');
        expect(result).toEqual({ insightsPersisted: 1 });
    });

    it('passes envelopeIds to context', async () => {
        const ctx = makeContext({ envelopes: [] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));

        await engine.run('org-1', { envelopeIds: ['e1', 'e2'] });

        expect(mockContextBuilder.build).toHaveBeenCalledWith('org-1', {
            envelopeIds: ['e1', 'e2'],
            windowStart: undefined,
            windowEnd: undefined,
        });
    });

    it('passes time window to context', async () => {
        const start = new Date('2026-01-01');
        const end = new Date('2026-01-02');
        const ctx = makeContext({ envelopes: [] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));

        await engine.run('org-1', { windowStart: start, windowEnd: end });

        expect(mockContextBuilder.build).toHaveBeenCalledWith('org-1', {
            envelopeIds: undefined,
            windowStart: start,
            windowEnd: end,
        });
    });

    it('returns 0 when there are no envelopes', async () => {
        const ctx = makeContext({ envelopes: [] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));

        const result = await engine.run('org-1');

        expect(mockPipeline.run).not.toHaveBeenCalled();
        expect(mockCapabilityManager.executeAll).not.toHaveBeenCalled();
        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('handles empty capability list gracefully', async () => {
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('calls previousIntelligence per chunk and passes to capabilities', async () => {
        const prevInsight: Insight = { id: 'existing-1', type: 'TASK', content: 'previous task', owners: ['u1'] };
        const prevMock = jest.fn().mockResolvedValue([prevInsight]);
        const ctx = makeContext({
            envelopes: [baseEnvelope],
            previousIntelligence: prevMock,
        });

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [] }],
            errors: [],
        });

        await engine.run('org-1');

        expect(prevMock).toHaveBeenCalledWith({
            scope: { sourcePlugin: 'telegram' },
            limit: 5,
        });
        expect(mockCapabilityManager.executeAll).toHaveBeenCalledWith({
            chunk: baseChunk,
            previousIntelligence: [prevInsight],
        });
    });

    it('logs capability errors and persists successful results', async () => {
        const insight: Insight = { id: null, type: 'INFO', content: 'good', owners: [] };
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-b', insights: [insight] }],
            errors: [{ capabilityName: 'cap-a', error: 'something failed' }],
        });

        const result = await engine.run('org-1');

        expect(Logger.prototype.warn).toHaveBeenCalled();
        expect(mockPersistence.persistAll).toHaveBeenCalledWith([insight], 'org-1');
        expect(result).toEqual({ insightsPersisted: 1 });
    });

    it('processes multiple windows in order', async () => {
        const insight: Insight = { id: null, type: 'INFO', content: 'from w1', owners: [] };
        const ctx1 = makeContext({
            window: { start: new Date('2026-01-01'), end: new Date('2026-01-02'), messageCount: 2 },
            envelopes: [baseEnvelope],
        });
        const ctx2 = makeContext({
            window: { start: new Date('2026-01-03'), end: new Date('2026-01-04'), messageCount: 2 },
            envelopes: [baseEnvelope],
        });

        mockContextBuilder.build.mockReturnValue(multiCtx(ctx1, ctx2));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [insight] }],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockPipeline.run).toHaveBeenCalledTimes(2);
        expect(mockPersistence.persistAll).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ insightsPersisted: 2 });
    });

    it('skips empty window', async () => {
        const insight: Insight = { id: null, type: 'INFO', content: 'from w2', owners: [] };
        const emptyCtx = makeContext({
            window: { start: new Date('2026-01-01'), end: new Date('2026-01-01'), messageCount: 0 },
            envelopes: [],
        });
        const nonEmptyCtx = makeContext({
            window: { start: new Date('2026-01-02'), end: new Date('2026-01-02'), messageCount: 1 },
            envelopes: [baseEnvelope],
        });

        mockContextBuilder.build.mockReturnValue(multiCtx(emptyCtx, nonEmptyCtx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [insight] }],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockPipeline.run).toHaveBeenCalledTimes(1);
        expect(mockPersistence.persistAll).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ insightsPersisted: 1 });
    });

    it('builds query from chunk with channelId and topicId', async () => {
        const envWithTopic: EnvelopeWithPayload = {
            envelope: { ...baseEnvelope.envelope },
            payload: { ...basePayload, channelId: 'c1', topicId: 't1' },
        };
        const chunkWithTopic: DataChunk = {
            id: 'chunk-topic',
            envelopes: [envWithTopic],
            metadata: { timeRange: { start: new Date(), end: new Date() }, envelopeCount: 1 },
        };
        const prevMock = jest.fn().mockResolvedValue([]);
        const ctx = makeContext({ envelopes: [envWithTopic], previousIntelligence: prevMock });

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(chunkWithTopic));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [], errors: [],
        });

        await engine.run('org-1');

        expect(prevMock).toHaveBeenCalledWith({
            scope: { sourcePlugin: 'telegram', channelId: 'c1', topicId: 't1' },
            limit: 5,
        });
    });

    it('builds query with groupId fallback when no channel/topic', async () => {
        const envWithGroup: EnvelopeWithPayload = {
            envelope: { ...baseEnvelope.envelope },
            payload: { ...basePayload, groupId: 'g1' },
        };
        const chunkWithGroup: DataChunk = {
            id: 'chunk-group',
            envelopes: [envWithGroup],
            metadata: { timeRange: { start: new Date(), end: new Date() }, envelopeCount: 1 },
        };
        const prevMock = jest.fn().mockResolvedValue([]);
        const ctx = makeContext({ envelopes: [envWithGroup], previousIntelligence: prevMock });

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(chunkWithGroup));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [], errors: [],
        });

        await engine.run('org-1');

        expect(prevMock).toHaveBeenCalledWith({
            scope: { sourcePlugin: 'telegram', groupId: 'g1' },
            limit: 5,
        });
    });

    it('calls previousIntelligence per chunk, not per window', async () => {
        const env1: EnvelopeWithPayload = {
            envelope: { ...baseEnvelope.envelope, id: 'e1' },
            payload: { ...basePayload, channelId: 'c1', topicId: 't1' },
        };
        const env2: EnvelopeWithPayload = {
            envelope: { ...baseEnvelope.envelope, id: 'e2' },
            payload: { ...basePayload, channelId: 'c2', topicId: 't2' },
        };
        const chunk1: DataChunk = {
            id: 'chunk-1', envelopes: [env1],
            metadata: { timeRange: { start: new Date(), end: new Date() }, envelopeCount: 1 },
        };
        const chunk2: DataChunk = {
            id: 'chunk-2', envelopes: [env2],
            metadata: { timeRange: { start: new Date(), end: new Date() }, envelopeCount: 1 },
        };

        const prevMock = jest.fn().mockResolvedValue([]);
        const ctx = makeContext({ envelopes: [env1, env2], previousIntelligence: prevMock });

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => multiChunk(chunk1, chunk2));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [], errors: [],
        });

        await engine.run('org-1');

        expect(prevMock).toHaveBeenCalledTimes(2);
        expect(prevMock).toHaveBeenNthCalledWith(1, {
            scope: { sourcePlugin: 'telegram', channelId: 'c1', topicId: 't1' },
            limit: 5,
        });
        expect(prevMock).toHaveBeenNthCalledWith(2, {
            scope: { sourcePlugin: 'telegram', channelId: 'c2', topicId: 't2' },
            limit: 5,
        });
    });

    it('returns 0 when builder yields 0 contexts', async () => {
        mockContextBuilder.build.mockReturnValue(noCtx());

        const result = await engine.run('org-1');

        expect(mockPipeline.run).not.toHaveBeenCalled();
        expect(mockCapabilityManager.executeAll).not.toHaveBeenCalled();
        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });
});
