import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { EntityRepository } from 'src/repositories/entity.repository';
import { RelationshipRepository } from 'src/repositories/relationship.repository';

describe('KnowledgeGraphExtractionCapability', () => {
    let capability: KnowledgeGraphExtractionCapability;
    let mockLlmService: {
        createGraphLLM: jest.Mock;
    };
    let mockGraphModel: { invoke: jest.Mock; withStructuredOutput?: jest.Mock };
    let mockEntityRepo: { upsert: jest.Mock };
    let mockRelationshipRepo: { upsert: jest.Mock };

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

        mockEntityRepo = {
            upsert: jest.fn().mockImplementation((dto) =>
                Promise.resolve({ id: `id-${dto.name}`, name: dto.name }),
            ),
        };

        mockRelationshipRepo = {
            upsert: jest.fn().mockResolvedValue({ id: 'rel-1' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KnowledgeGraphExtractionCapability,
                { provide: LlmService, useValue: mockLlmService },
                { provide: EntityRepository, useValue: mockEntityRepo },
                { provide: RelationshipRepository, useValue: mockRelationshipRepo },
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

    it('should perform single-pass direct structured extraction and merge nodes & relationships', async () => {
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
        expect(mockEntityRepo.upsert).toHaveBeenCalledTimes(2);
        expect(mockRelationshipRepo.upsert).toHaveBeenCalledTimes(1);
    });
});
