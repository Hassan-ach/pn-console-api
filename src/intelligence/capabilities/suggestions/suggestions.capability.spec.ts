import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsCapability } from './suggestions.capability';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import { InsightSuggestionRepository } from 'src/repositories/insight-suggestion.repository';

describe('SuggestionsCapability', () => {
    let capability: SuggestionsCapability;
    let mockLlmService: { createToolChain: jest.Mock };
    let mockGraphToolsService: { getTools: jest.Mock };
    let mockSuggestionRepo: { createMany: jest.Mock };
    let mockChain: { invoke: jest.Mock };

    beforeEach(async () => {
        mockChain = { invoke: jest.fn() };
        mockLlmService = {
            createToolChain: jest.fn().mockResolvedValue(mockChain),
        };
        mockGraphToolsService = {
            getTools: jest.fn().mockReturnValue([]),
        };
        mockSuggestionRepo = {
            createMany: jest.fn().mockResolvedValue(1),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SuggestionsCapability,
                { provide: LlmService, useValue: mockLlmService },
                { provide: GraphToolsService, useValue: mockGraphToolsService },
                {
                    provide: InsightSuggestionRepository,
                    useValue: mockSuggestionRepo,
                },
            ],
        }).compile();

        capability = module.get<SuggestionsCapability>(SuggestionsCapability);
    });

    it('should have name "suggestions-extractor"', () => {
        expect(capability.name).toBe('suggestions-extractor');
    });

    it('should execute and generate suggestions when history insights exist', async () => {
        const sampleEnvelopes: any[] = [
            {
                envelope: {
                    id: 'env-1',
                    sourcePlugin: 'slack',
                    organizationId: 'org-1',
                },
                payload: { content: 'Outage on billing service' },
            },
        ];

        const sampleHistory: any[] = [
            {
                id: 'insight-1',
                type: 'URGENCY',
                content: 'Billing service is down',
            },
        ];

        const llmResult = JSON.stringify({
            suggestions: [
                {
                    insightId: 'insight-1',
                    title: 'Escalate to DevOps Team',
                    contextSummary: ['Billing service spend is high'],
                    options: [
                        {
                            label: 'Option A',
                            title: 'Escalate to DevOps Team',
                            description:
                                'Reassign outage ticket to billing maintainers',
                            actionType: 'ESCALATE',
                            risk: 'Low',
                            reasoning:
                                'Billing service outage requires senior engineer response',
                        },
                    ],
                },
            ],
        });

        mockChain.invoke.mockResolvedValue(llmResult);

        const result = await capability.execute({
            chunk: { envelopes: sampleEnvelopes } as never,
            previousIntelligence: sampleHistory as never,
        });

        expect(result.capabilityName).toBe('suggestions-extractor');
        expect(mockSuggestionRepo.createMany).toHaveBeenCalledWith([
            {
                insightId: 'insight-1',
                organizationId: 'org-1',
                title: 'Escalate to DevOps Team',
                description: 'Reassign outage ticket to billing maintainers',
                actionType: 'ESCALATE',
                reasoning:
                    'Billing service outage requires senior engineer response',
                metadata: {
                    contextSummary: ['Billing service spend is high'],
                    optionLabel: 'Option A',
                    optionTitle: 'Escalate to DevOps Team',
                    risk: 'Low',
                },
            },
        ]);
    });
});
