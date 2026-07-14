import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { IntelligenceEngineService } from './intelligence-engine.service';
import { EnterpriseContextBuilder } from './context/enterprise-context-builder.abstract';
import { ChunkingPipeline } from './chunking/chunking-pipeline.service';
import { CapabilityManager } from './capabilities/capability-manager.service';
import { InsightPersistenceService } from './store/insight-persistence.service';
import type { EnterpriseContext } from './context/enterprise-context.types';
import type { Insight } from '../types/insight.types';
import type { DataChunk } from './chunking/types/data-chunk.type';
import type { EnvelopeWithPayload } from '../types/envelope.types';

function makeContext(overrides?: {
    previousIntelligence?: AsyncIterable<Insight[]>;
    envelopes?: AsyncIterable<EnvelopeWithPayload[]>;
}): EnterpriseContext {
    return {
        organizationId: 'org-1',
        metadata: {},
        previousIntelligence: jest
            .fn()
            .mockReturnValue(
                overrides?.previousIntelligence ?? (async function* () {})(),
            ),
        envelopes: jest
            .fn()
            .mockReturnValue(overrides?.envelopes ?? (async function* () {})()),
    };
}

async function* singleBatch<T>(batch: T[]): AsyncIterable<T[]> {
    yield batch;
}

async function* singleChunk(chunk: DataChunk): AsyncIterable<DataChunk> {
    yield chunk;
}

describe('IntelligenceEngineService', () => {
    let engine: IntelligenceEngineService;
    let mockContextBuilder: jest.Mocked<EnterpriseContextBuilder>;
    let mockPipeline: jest.Mocked<ChunkingPipeline>;
    let mockCapabilityManager: jest.Mocked<CapabilityManager>;
    let mockPersistence: jest.Mocked<InsightPersistenceService>;
    let mockCtx: EnterpriseContext;

    beforeEach(async () => {
        mockCtx = makeContext();

        mockContextBuilder = {
            build: jest.fn().mockReturnValue(mockCtx),
        };

        mockPipeline = {
            run: jest.fn().mockReturnValue((async function* () {})()),
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
                {
                    provide: EnterpriseContextBuilder,
                    useValue: mockContextBuilder,
                },
                {
                    provide: ChunkingPipeline,
                    useValue: mockPipeline,
                },
                {
                    provide: CapabilityManager,
                    useValue: mockCapabilityManager,
                },
                {
                    provide: InsightPersistenceService,
                    useValue: mockPersistence,
                },
            ],
        }).compile();

        engine = module.get(IntelligenceEngineService);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('builds context, chunks, executes capabilities, and persists results', async () => {
        const envelope: EnvelopeWithPayload = {
            envelope: {
                id: 'e1',
                sourcePlugin: 'telegram',
                sourceId: 's1',
                type: 'message',
                hasAttachment: false,
                authorId: 'u1',
                occurredAt: new Date(),
            },
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hello',
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

        const chunk: DataChunk = {
            id: 'chunk-1',
            envelopes: [envelope],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 1,
            },
        };

        const insight: Insight = {
            id: null,
            type: 'INFO',
            content: 'extracted',
            owners: [],
        };

        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch([envelope]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);
        mockPipeline.run.mockReturnValue(singleChunk(chunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [insight] }],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockContextBuilder.build).toHaveBeenCalledWith('org-1');
        expect(mockCtx.previousIntelligence).toHaveBeenCalledWith({});
        expect(mockCtx.envelopes).toHaveBeenCalledWith({
            ids: undefined,
            windowStart: undefined,
            windowEnd: undefined,
        });
        expect(mockPipeline.run).toHaveBeenCalledWith([envelope]);
        expect(mockCapabilityManager.executeAll).toHaveBeenCalledWith({
            chunk,
            previousIntelligence: [],
        });
        expect(mockPersistence.persistAll).toHaveBeenCalledWith([insight], 'org-1');
        expect(result).toEqual({ insightsPersisted: 1 });
    });

    it('passes envelopeIds to context', async () => {
        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch<EnvelopeWithPayload>([]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);

        await engine.run('org-1', { envelopeIds: ['e1', 'e2'] });

        expect(mockCtx.envelopes).toHaveBeenCalledWith({
            ids: ['e1', 'e2'],
            windowStart: undefined,
            windowEnd: undefined,
        });
    });

    it('passes time window to context', async () => {
        const start = new Date('2026-01-01');
        const end = new Date('2026-01-02');

        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch<EnvelopeWithPayload>([]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);

        await engine.run('org-1', {
            windowStart: start,
            windowEnd: end,
        });

        expect(mockCtx.envelopes).toHaveBeenCalledWith({
            ids: undefined,
            windowStart: start,
            windowEnd: end,
        });
    });

    it('returns 0 when there are no envelopes', async () => {
        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch<EnvelopeWithPayload>([]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);

        const result = await engine.run('org-1');

        expect(mockPipeline.run).not.toHaveBeenCalled();
        expect(mockCapabilityManager.executeAll).not.toHaveBeenCalled();
        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('handles empty capability list gracefully', async () => {
        const envelope: EnvelopeWithPayload = {
            envelope: {
                id: 'e1',
                sourcePlugin: 'telegram',
                sourceId: 's1',
                type: 'message',
                hasAttachment: false,
                authorId: 'u1',
                occurredAt: new Date(),
            },
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hello',
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

        const chunk: DataChunk = {
            id: 'chunk-1',
            envelopes: [envelope],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 1,
            },
        };

        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch([envelope]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);
        mockPipeline.run.mockReturnValue(singleChunk(chunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [],
            errors: [],
        });

        const result = await engine.run('org-1');

        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('collects previous intelligence once and passes to capabilities', async () => {
        const prevInsight: Insight = {
            id: 'existing-1',
            type: 'TASK',
            content: 'previous task',
            owners: ['u1'],
        };

        const envelope: EnvelopeWithPayload = {
            envelope: {
                id: 'e1',
                sourcePlugin: 'telegram',
                sourceId: 's1',
                type: 'message',
                hasAttachment: false,
                authorId: 'u1',
                occurredAt: new Date(),
            },
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hello',
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

        const chunk: DataChunk = {
            id: 'chunk-1',
            envelopes: [envelope],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 1,
            },
        };

        mockCtx = makeContext({
            previousIntelligence: singleBatch([prevInsight]),
            envelopes: singleBatch([envelope]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);
        mockPipeline.run.mockReturnValue(singleChunk(chunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-a', insights: [] }],
            errors: [],
        });

        await engine.run('org-1');

        expect(mockCapabilityManager.executeAll).toHaveBeenCalledWith({
            chunk,
            previousIntelligence: [prevInsight],
        });
    });

    it('logs capability errors and persists successful results', async () => {
        const envelope: EnvelopeWithPayload = {
            envelope: {
                id: 'e1',
                sourcePlugin: 'telegram',
                sourceId: 's1',
                type: 'message',
                hasAttachment: false,
                authorId: 'u1',
                occurredAt: new Date(),
            },
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hello',
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

        const chunk: DataChunk = {
            id: 'chunk-1',
            envelopes: [envelope],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 1,
            },
        };

        const insight: Insight = {
            id: null,
            type: 'INFO',
            content: 'good',
            owners: [],
        };

        mockCtx = makeContext({
            previousIntelligence: singleBatch<Insight>([]),
            envelopes: singleBatch([envelope]),
        });
        mockContextBuilder.build.mockReturnValue(mockCtx);
        mockPipeline.run.mockReturnValue(singleChunk(chunk));
        mockCapabilityManager.executeAll.mockResolvedValue({
            results: [{ capabilityName: 'cap-b', insights: [insight] }],
            errors: [{ capabilityName: 'cap-a', error: 'something failed' }],
        });

        const result = await engine.run('org-1');

        expect(Logger.prototype.warn).toHaveBeenCalled();
        expect(mockPersistence.persistAll).toHaveBeenCalledWith([insight], 'org-1');
        expect(result).toEqual({ insightsPersisted: 1 });
    });
});
