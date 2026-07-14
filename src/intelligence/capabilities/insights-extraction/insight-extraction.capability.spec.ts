import { Test, TestingModule } from '@nestjs/testing';
import { RunnableLambda } from '@langchain/core/runnables';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { RESOLVE_USERS_TOOL } from '../../tools/tools.module';
import { CapabilityInput } from '../capability.interface';

const sampleInput: CapabilityInput = {
    chunk: {
        id: 'test-chunk',
        envelopes: [
            {
                envelope: {
                    id: '1',
                    sourcePlugin: 'telegram',
                    sourceId: 'src-1',
                    type: 'message',
                    hasAttachment: false,
                    authorId: null,
                    occurredAt: new Date(),
                },
                payload: {
                    type: 'direct',
                    content:
                        'Q3 budget report has been sent to finance, all done.',
                    groupId: null,
                    channelId: null,
                    replyTo: null,
                    reactions: {},
                    pinned: false,
                    editedDate: null,
                    entities: null,
                    rawPayload: {},
                },
            },
        ],
        metadata: {
            timeRange: { start: new Date(), end: new Date() },
            envelopeCount: 1,
        },
    },
    previousIntelligence: [
        {
            id: '1',
            organizationId: 'org-1',
            type: 'TASK',
            content: 'Send the Q3 budget report to the finance team',
            owners: [],
            broadcasted: false,
        },
        {
            id: '2',
            organizationId: 'org-1',
            type: 'URGENCY',
            content: 'Production server CPU usage spiking above 90%',
            owners: [],
            broadcasted: true,
        },
    ],
};

const sampleResult = {
    updatedInsights: [
        {
            id: '1',
            type: 'INFO',
            content: 'Q3 budget report was sent to finance.',
            owners: [],
            envolopsRef: ['1'],
            broadcasted: false,
        },
    ],
    newInsights: [],
};

describe('InsightExtractionCapability', () => {
    let service: InsightExtractionCapability;
    let chainInvoke: jest.Mock;

    beforeEach(async () => {
        chainInvoke = jest
            .fn()
            .mockResolvedValue(JSON.stringify(sampleResult));

        const fakeChain = RunnableLambda.from(async () => {
            const raw = await chainInvoke();
            return raw;
        });

        const llmServiceMock = {
            createLLM: jest.fn(),
            createToolChain: jest.fn().mockResolvedValue(fakeChain),
        };

        const mockResolveUsersTool = {
            name: 'resolve_users',
            description: 'mock',
            invoke: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightExtractionCapability,
                { provide: LlmService, useValue: llmServiceMock },
                { provide: RESOLVE_USERS_TOOL, useValue: mockResolveUsersTool },
            ],
        }).compile();

        service = module.get<InsightExtractionCapability>(
            InsightExtractionCapability,
        );
        await service.onModuleInit();
    });

    it('should connect to llm', async () => {
        const input: CapabilityInput = {
            chunk: {
                id: 'c',
                envelopes: [],
                metadata: {
                    timeRange: { start: new Date(), end: new Date() },
                    envelopeCount: 0,
                },
            },
            previousIntelligence: [],
        };
        const response = await service.execute(input);

        expect(response.capabilityName).toBe('insights-extractor');
        expect(response.insights).toBeTruthy();
    });

    it('should return a valid schema result', async () => {
        const result = await service.execute(sampleInput);

        expect(result.capabilityName).toBe('insights-extractor');
        expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should throw because LLM service is unreachable', async () => {
        chainInvoke.mockRejectedValue(new Error('network error'));

        const input: CapabilityInput = {
            chunk: {
                id: 'c',
                envelopes: [],
                metadata: {
                    timeRange: { start: new Date(), end: new Date() },
                    envelopeCount: 0,
                },
            },
            previousIntelligence: [],
        };
        await expect(service.execute(input)).rejects.toThrow(
            'insights extraction failed',
        );
    }, 10_000);

    it('should throw because of unstructured output', async () => {
        chainInvoke.mockResolvedValue(JSON.stringify({ newInsights: {} }));

        const input: CapabilityInput = {
            chunk: {
                id: 'c',
                envelopes: [],
                metadata: {
                    timeRange: { start: new Date(), end: new Date() },
                    envelopeCount: 0,
                },
            },
            previousIntelligence: [],
        };
        await expect(service.execute(input)).rejects.toThrow(
            'insights extraction failed',
        );
    }, 10_000);
});
