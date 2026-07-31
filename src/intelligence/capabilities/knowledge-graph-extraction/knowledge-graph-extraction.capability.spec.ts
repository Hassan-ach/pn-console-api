/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { Neo4jService } from 'src/graph/neo4j.service';

describe('KnowledgeGraphExtractionCapability', () => {
    let capability: KnowledgeGraphExtractionCapability;
    let mockLlmService: {
        createGraphLLM: jest.Mock;
    };
    let mockGraphModel: { invoke: jest.Mock; withStructuredOutput?: jest.Mock };
    let mockNeo4jService: {
        getDriver: jest.Mock;
        executeWrite: jest.Mock;
    };

    beforeEach(async () => {
        mockGraphModel = {
            invoke: jest.fn(),
            withStructuredOutput: jest.fn().mockReturnValue({
                invoke: jest.fn().mockResolvedValue({
                    nodes: [
                        { name: 'Elon Musk', type: 'Person', role: 'Founder' },
                        { name: 'SpaceX', type: 'Project' },
                    ],
                    relationships: [
                        {
                            sourceName: 'Elon Musk',
                            targetName: 'SpaceX',
                            type: 'WORKS_ON',
                        },
                    ],
                }),
            }),
        };

        mockLlmService = {
            createGraphLLM: jest.fn().mockResolvedValue(mockGraphModel),
        };

        mockNeo4jService = {
            getDriver: jest.fn().mockReturnValue({}),
            executeWrite: jest.fn().mockImplementation((_cypher, params) => {
                if (params?.name) {
                    return Promise.resolve([{ id: `id-${params.name}` }]);
                }
                return Promise.resolve([{ id: 'rel-1' }]);
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KnowledgeGraphExtractionCapability,
                { provide: LlmService, useValue: mockLlmService },
                { provide: Neo4jService, useValue: mockNeo4jService },
            ],
        }).compile();

        capability = module.get<KnowledgeGraphExtractionCapability>(
            KnowledgeGraphExtractionCapability,
        );
    });

    it('should have name "knowledge-graph-extractor"', () => {
        expect(capability.name).toBe('knowledge-graph-extractor');
    });

    it('should return empty insights and skip processing if envelopes array is empty', async () => {
        const result = await capability.execute({
            chunk: { envelopes: [] } as never,
            previousIntelligence: [] as never,
        });

        expect(result.capabilityName).toBe('knowledge-graph-extractor');
        expect(result.insights).toEqual([]);
        expect(mockLlmService.createGraphLLM).not.toHaveBeenCalled();
    });

    it('should perform single-pass direct structured extraction and merge nodes & relationships to Neo4j', async () => {
        const sampleEnvelopes: any[] = [
            {
                envelope: {
                    id: 'env-1',
                    sourcePlugin: 'slack',
                    authorId: 'user-1',
                    organizationId: 'org-1',
                    occurredAt: new Date('2026-07-30T10:00:00Z'),
                },
                payload: {
                    content: 'Elon Musk founded SpaceX in 2002.',
                    groupId: 'group-1',
                },
            },
        ];

        const result = await capability.execute({
            chunk: { envelopes: sampleEnvelopes } as never,
            previousIntelligence: [],
        });

        expect(result.capabilityName).toBe('knowledge-graph-extractor');
        expect(result.insights).toEqual([]); // Must never return insights
        expect(mockNeo4jService.executeWrite).toHaveBeenCalledTimes(3); // 2 nodes + 1 rel
    });
});
