/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import { IntelligenceEngineService } from './intelligence-engine.service';
import { EnterpriseContextBuilder } from './context/builders/enterprise-context-builder.abstract';
import { ChunkingPipeline } from './chunking/services/chunking-pipeline.service';
import { CapabilityManager } from './capabilities/capability-manager.service';
import { InsightPersistenceService } from './store/insight-persistence.service';
import { CapabilityFailureRepository } from '../repositories/capability-failure.repository';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import type {
    EnterpriseContext,
    RetrievalWindow,
} from './context/types/enterprise-context.types';
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
    end: new Date('2026-01-02'),
    messageCount: 1,
};

function makeContext(
    overrides: Partial<EnterpriseContext> = {},
): EnterpriseContext {
    return {
        window: defaultWindow,
        envelopes: [baseEnvelope],
        previousIntelligence: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
}

async function* singleCtx(
    ctx: EnterpriseContext,
): AsyncIterable<EnterpriseContext> {
    yield ctx;
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
    let mockFailureRepository: jest.Mocked<CapabilityFailureRepository>;
    let mockEnvelopeRepo: jest.Mocked<EnvelopeRepository>;
    let mockConfig: jest.Mocked<ConfigService>;
    let mockEventBus: jest.Mocked<IEventBus>;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(
            () => undefined,
        );
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

        mockContextBuilder = {
            build: jest.fn(),
        };

        mockPipeline = {
            run: jest.fn(),
        } as unknown as jest.Mocked<ChunkingPipeline>;

        mockCapabilityManager = {
            executeByName: jest.fn().mockImplementation(async (name) => {
                if (name === 'knowledge-graph-extractor') {
                    return {
                        capabilityName: 'knowledge-graph-extractor',
                        insights: [],
                    };
                }
                return {
                    capabilityName: 'insights-extractor-v2',
                    insights: [],
                };
            }),
            executeAll: jest.fn(),
        } as unknown as jest.Mocked<CapabilityManager>;

        mockPersistence = {
            persistAll: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<InsightPersistenceService>;

        mockFailureRepository = {
            create: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue(0),
            findByOrganizationId: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<CapabilityFailureRepository>;

        mockEnvelopeRepo = {
            markStatus: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<EnvelopeRepository>;

        mockConfig = {
            get: jest.fn((key: string, defaultVal?: unknown) => {
                if (key === 'engine.previousInsightLimit') return 5;
                return defaultVal;
            }),
        } as unknown as jest.Mocked<ConfigService>;

        mockEventBus = {
            publish: jest.fn(),
            publishAsync: jest.fn().mockResolvedValue([{ jobId: 'job-1' }]),
            subscribe: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntelligenceEngineService,
                {
                    provide: EnterpriseContextBuilder,
                    useValue: mockContextBuilder,
                },
                { provide: ChunkingPipeline, useValue: mockPipeline },
                { provide: CapabilityManager, useValue: mockCapabilityManager },
                {
                    provide: InsightPersistenceService,
                    useValue: mockPersistence,
                },
                {
                    provide: CapabilityFailureRepository,
                    useValue: mockFailureRepository,
                },
                { provide: EnvelopeRepository, useValue: mockEnvelopeRepo },
                { provide: ConfigService, useValue: mockConfig },
                { provide: EVENT_BUS_TOKEN, useValue: mockEventBus },
            ],
        }).compile();

        engine = module.get<IntelligenceEngineService>(
            IntelligenceEngineService,
        );
    });

    it('builds context, chunks, executes capabilities by name, and persists results', async () => {
        const insight: Insight = {
            id: null,
            type: 'INFO',
            content: 'test',
            owners: [],
        };
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        const prevMock = ctx.previousIntelligence as jest.Mock;
        prevMock.mockResolvedValue([]);

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeByName.mockImplementation(async (name) => {
            if (name === 'knowledge-graph-extractor') {
                return {
                    capabilityName: 'knowledge-graph-extractor',
                    insights: [],
                };
            }
            return {
                capabilityName: 'insights-extractor-v2',
                insights: [insight],
            };
        });

        const result = await engine.run('org-1');

        expect(mockContextBuilder.build).toHaveBeenCalledWith('org-1', {
            envelopeIds: undefined,
            windowStart: undefined,
            windowEnd: undefined,
        });
        expect(mockPipeline.run).toHaveBeenCalledWith([baseEnvelope]);
        expect(mockCapabilityManager.executeByName).toHaveBeenCalledWith(
            'knowledge-graph-extractor',
            expect.any(Object),
        );
        expect(mockCapabilityManager.executeByName).toHaveBeenCalledWith(
            'insights-extractor-v2',
            expect.any(Object),
        );
        expect(mockPersistence.persistAll).toHaveBeenCalledWith(
            [insight],
            'org-1',
        );
        expect(result).toEqual({ insightsPersisted: 1 });
    });

    it('returns 0 when there are no envelopes', async () => {
        const ctx = makeContext({ envelopes: [] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));

        const result = await engine.run('org-1');

        expect(mockPipeline.run).not.toHaveBeenCalled();
        expect(mockCapabilityManager.executeByName).not.toHaveBeenCalled();
        expect(mockPersistence.persistAll).not.toHaveBeenCalled();
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('calls previousIntelligence per chunk and passes to capabilities', async () => {
        const prevInsight: Insight = {
            id: 'existing-1',
            type: 'TASK',
            content: 'previous task',
            owners: ['u1'],
        };
        const prevMock = jest.fn().mockResolvedValue([prevInsight]);
        const ctx = makeContext({
            envelopes: [baseEnvelope],
            previousIntelligence: prevMock,
        });

        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));

        await engine.run('org-1');

        expect(prevMock).toHaveBeenCalledWith({
            scope: { sourcePlugin: 'telegram' },
            limit: 5,
        });
        expect(mockCapabilityManager.executeByName).toHaveBeenCalledWith(
            'knowledge-graph-extractor',
            {
                chunk: baseChunk,
                previousIntelligence: [prevInsight],
                organizationId: 'org-1',
            },
        );
        expect(mockCapabilityManager.executeByName).toHaveBeenCalledWith(
            'insights-extractor-v2',
            {
                chunk: baseChunk,
                previousIntelligence: [prevInsight],
                organizationId: 'org-1',
            },
        );
    });

    it('logs capability errors and records failure when insight capability fails', async () => {
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));

        mockCapabilityManager.executeByName.mockImplementation(async (name) => {
            if (name === 'knowledge-graph-extractor') {
                return {
                    capabilityName: 'knowledge-graph-extractor',
                    insights: [],
                };
            }
            throw new Error('LLM timeout');
        });

        const result = await engine.run('org-1');

        expect(Logger.prototype.warn).toHaveBeenCalled();
        expect(mockFailureRepository.createMany).toHaveBeenCalledWith([
            {
                capabilityName: 'insights-extractor-v2',
                chunkId: 'chunk-1',
                errorMessage: 'LLM timeout',
                envelopeIds: ['e1'],
                organizationId: 'org-1',
            },
        ]);
        expect(mockEnvelopeRepo.markStatus).toHaveBeenCalledWith(
            ['e1'],
            'FAILED',
        );
        expect(result).toEqual({ insightsPersisted: 0 });
    });

    it('marks envelopes READY when capabilities succeed', async () => {
        const insight: Insight = {
            id: null,
            type: 'INFO',
            content: 'ok',
            owners: [],
        };
        const ctx = makeContext({ envelopes: [baseEnvelope] });
        mockContextBuilder.build.mockReturnValue(singleCtx(ctx));
        mockPipeline.run.mockImplementation(() => singleChunk(baseChunk));
        mockCapabilityManager.executeByName.mockImplementation(async (name) => {
            if (name === 'knowledge-graph-extractor') {
                return {
                    capabilityName: 'knowledge-graph-extractor',
                    insights: [],
                };
            }
            return {
                capabilityName: 'insights-extractor-v2',
                insights: [insight],
            };
        });

        await engine.run('org-1');

        expect(mockEnvelopeRepo.markStatus).toHaveBeenCalledWith(
            ['e1'],
            'READY',
        );
    });
});
