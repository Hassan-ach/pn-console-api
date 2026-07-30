import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction.capability';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';

describe('KnowledgeGraphExtractionCapability', () => {
    let capability: KnowledgeGraphExtractionCapability;
    let mockLlmService: any;
    let mockGraphToolsService: any;
    let mockChain: any;

    beforeEach(async () => {
        mockChain = {
            invoke: jest.fn().mockResolvedValue('Done'),
        };

        mockLlmService = {
            createGraphLLM: jest.fn().mockResolvedValue({}),
            createToolChain: jest.fn().mockResolvedValue(mockChain),
        };

        mockGraphToolsService = {
            getTools: jest.fn().mockReturnValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KnowledgeGraphExtractionCapability,
                { provide: LlmService, useValue: mockLlmService },
                { provide: GraphToolsService, useValue: mockGraphToolsService },
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
        const input: any = { chunk: { envelopes: [] } };
        const result = await capability.execute(input);

        expect(result.capabilityName).toBe('knowledge-graph-extractor');
        expect(result.insights).toEqual([]);
        expect(mockLlmService.createGraphLLM).not.toHaveBeenCalled();
    });

    it('should execute agent loop tool chain for graph mutation', async () => {
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
                    content: 'Alice is working on the pn-console-api service.',
                    groupId: 'group-1',
                },
            },
        ];

        const result = await capability.execute({
            chunk: { envelopes: sampleEnvelopes } as any,
            previousIntelligence: [],
        });

        expect(result.capabilityName).toBe('knowledge-graph-extractor');
        expect(result.insights).toEqual([]); // Must never return insights
        expect(mockGraphToolsService.getTools).toHaveBeenCalledWith('org-1');
        expect(mockLlmService.createToolChain).toHaveBeenCalled();
        expect(mockChain.invoke).toHaveBeenCalled();
    });
});
