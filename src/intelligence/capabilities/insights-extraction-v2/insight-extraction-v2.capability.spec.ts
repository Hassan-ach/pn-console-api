import { Test, TestingModule } from '@nestjs/testing';
import { InsightExtractionCapabilityV2 } from './insight-extraction-v2.capability';
import { LlmService } from '../../llm/llm.service';
import { GraphToolsService } from '../../tools/graph-tools.service';
import { SearchToolsService } from '../../tools/search-tools.service';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { EntityRepository } from 'src/repositories/entity.repository';
import { InsightType } from 'src/types/insight.types';

describe('InsightExtractionCapabilityV2', () => {
    let capability: InsightExtractionCapabilityV2;
    let mockLlmService: { createToolChain: jest.Mock };
    let mockGraphToolsService: { getTools: jest.Mock };
    let mockSearchToolsService: { getTools: jest.Mock };
    let mockPlatformUserMappingRepo: { findWithUser: jest.Mock };
    let mockChain: { invoke: jest.Mock };

    beforeEach(async () => {
        mockChain = { invoke: jest.fn() };

        mockLlmService = {
            createToolChain: jest.fn().mockResolvedValue(mockChain),
        };

        mockGraphToolsService = {
            getTools: jest.fn().mockReturnValue([]),
        };

        mockSearchToolsService = {
            getTools: jest.fn().mockReturnValue([]),
        };

        mockPlatformUserMappingRepo = {
            findWithUser: jest.fn().mockResolvedValue([
                {
                    platformUserId: 'p-123',
                    appUserId: 'app-user-1',
                    platformUsername: 'alice',
                    pluginName: 'slack',
                    user: { firstName: 'Alice', lastName: 'Smith' },
                },
            ]),
        };

        const mockUserRepo = {
            findByOrganization: jest.fn().mockResolvedValue([
                {
                    id: 'app-user-1',
                    firstName: 'Alice',
                    lastName: 'Smith',
                    email: 'alice@example.com',
                },
            ]),
        };

        const mockEntityRepo = {
            search: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightExtractionCapabilityV2,
                { provide: LlmService, useValue: mockLlmService },
                { provide: GraphToolsService, useValue: mockGraphToolsService },
                { provide: SearchToolsService, useValue: mockSearchToolsService },
                {
                    provide: PlatformUserMappingRepository,
                    useValue: mockPlatformUserMappingRepo,
                },
                { provide: UserRepository, useValue: mockUserRepo },
                { provide: EntityRepository, useValue: mockEntityRepo },
            ],
        }).compile();

        capability = module.get<InsightExtractionCapabilityV2>(
            InsightExtractionCapabilityV2,
        );
    });

    it('should have name "insights-extractor-v2"', () => {
        expect(capability.name).toBe('insights-extractor-v2');
    });

    it('should extract insights using graph tools and resolve owners', async () => {
        const sampleEnvelopes: any[] = [
            {
                envelope: {
                    id: 'env-100',
                    sourcePlugin: 'slack',
                    authorId: 'p-123',
                    organizationId: 'org-1',
                    occurredAt: new Date('2026-07-28'),
                },
                payload: {
                    content: 'Refactor user-db service by Friday.',
                    groupId: 'g-1',
                },
            },
        ];

        const llmResult = JSON.stringify({
            updatedInsights: [],
            newInsights: [
                {
                    type: 'TASK',
                    content: 'Refactor user-db service',
                    owners: [{ id: 'p-123', username: 'alice' }],
                    envolopsRef: ['env-100'],
                    broadcasted: false,
                    excludeAuthor: false,
                    priority: 8,
                    deadline: '2026-08-01',
                },
            ],
        });

        mockChain.invoke.mockResolvedValue(llmResult);

        const result = await capability.execute({
            chunk: { envelopes: sampleEnvelopes } as never,
            previousIntelligence: [],
        });

        expect(result.capabilityName).toBe('insights-extractor-v2');
        expect(result.insights).toHaveLength(1);
        expect(result.insights[0].type).toBe(InsightType.TASK);
        expect(result.insights[0].owners).toEqual(['app-user-1']);
        expect(result.insights[0].priority).toBe(8);
        expect(result.insights[0].deadline).toBeDefined();
    });
});
