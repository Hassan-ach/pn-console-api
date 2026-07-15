import { Test, TestingModule } from '@nestjs/testing';
import { InsightExtractionCapability } from './insight-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
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
                    topicId: null,
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
    let llmInvoke: jest.Mock;
    let platformRepoMock: { findByPluginName: jest.Mock };

    beforeEach(async () => {
        llmInvoke = jest.fn().mockResolvedValue({
            content: JSON.stringify(sampleResult),
        });

        const llmServiceMock = {
            createLLM: jest.fn().mockResolvedValue({
                invoke: llmInvoke,
            }),
        };

        platformRepoMock = {
            findByPluginName: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightExtractionCapability,
                { provide: LlmService, useValue: llmServiceMock },
                {
                    provide: PlatformUserMappingRepository,
                    useValue: platformRepoMock,
                },
            ],
        }).compile();

        service = module.get<InsightExtractionCapability>(
            InsightExtractionCapability,
        );
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
        llmInvoke.mockRejectedValue(new Error('network error'));

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
        llmInvoke.mockResolvedValue({
            content: JSON.stringify({ newInsights: {} }),
        });

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

    it('should resolve owner references via PlatformUserMappingRepository', async () => {
        const resultWithOwners = {
            updatedInsights: [],
            newInsights: [
                {
                    type: 'TASK',
                    content: 'Alice needs to review the PR.',
                    owners: [{ username: 'alice_dev' }, { id: 'tg-123' }],
                    envolopsRef: ['1'],
                    broadcasted: false,
                },
            ],
        };

        llmInvoke.mockResolvedValue({
            content: JSON.stringify(resultWithOwners),
        });

        platformRepoMock.findByPluginName.mockResolvedValue([
            {
                platformUserId: 'tg-123',
                appUserId: 'app-user-bob',
                pluginName: 'telegram',
                platformUsername: 'bob_ops',
            },
            {
                platformUserId: 'tg-456',
                appUserId: 'app-user-alice',
                pluginName: 'telegram',
                platformUsername: 'alice_dev',
            },
        ]);

        const input: CapabilityInput = {
            chunk: {
                id: 'c',
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
                            content: 'test',
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
                    },
                ],
                metadata: {
                    timeRange: { start: new Date(), end: new Date() },
                    envelopeCount: 1,
                },
            },
            previousIntelligence: [],
        };

        const result = await service.execute(input);

        expect(result.insights).toHaveLength(1);
        expect(result.insights[0].owners).toEqual(
            expect.arrayContaining(['app-user-alice', 'app-user-bob']),
        );
    });

    it('should skip unresolvable owners', async () => {
        const resultWithOwners = {
            updatedInsights: [],
            newInsights: [
                {
                    type: 'TASK',
                    content: 'Unknown user task.',
                    owners: [{ username: 'unknown_user' }],
                    envolopsRef: ['1'],
                    broadcasted: false,
                },
            ],
        };

        llmInvoke.mockResolvedValue({
            content: JSON.stringify(resultWithOwners),
        });

        platformRepoMock.findByPluginName.mockResolvedValue([]);

        const input: CapabilityInput = {
            chunk: {
                id: 'c',
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
                            content: 'test',
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
                    },
                ],
                metadata: {
                    timeRange: { start: new Date(), end: new Date() },
                    envelopeCount: 1,
                },
            },
            previousIntelligence: [],
        };

        const result = await service.execute(input);

        expect(result.insights).toHaveLength(1);
        expect(result.insights[0].owners).toEqual([]);
    });
});
