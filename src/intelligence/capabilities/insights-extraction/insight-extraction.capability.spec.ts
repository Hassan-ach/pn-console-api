import { Test, TestingModule } from '@nestjs/testing';
import { RunnableLambda } from '@langchain/core/runnables';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { InsightResultSchema } from './insight-schema';
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
    let modelInvoke: jest.Mock<Promise<unknown>, []>;

    beforeEach(async () => {
        modelInvoke = jest.fn().mockResolvedValue(sampleResult);

        const fakeStructuredLlm = RunnableLambda.from(async () => {
            const value = await modelInvoke();
            return InsightResultSchema.parse(value);
        });

        const fakeLlm = {
            withStructuredOutput: jest.fn().mockReturnValue(fakeStructuredLlm),
        };

        const llmServiceMock = {
            createLLM: jest.fn().mockResolvedValue(fakeLlm),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightExtractionCapability,
                { provide: LlmService, useValue: llmServiceMock },
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
        modelInvoke.mockRejectedValue(new Error('network error'));

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
            'insights extraction failed after 3 attempts',
        );
    }, 10_000);

    it('should throw because of unstructured output', async () => {
        modelInvoke.mockResolvedValue({ newInsights: {} });

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
            'insights extraction failed after 3 attempts',
        );
    }, 10_000);
});
