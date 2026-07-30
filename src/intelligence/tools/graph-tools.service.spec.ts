import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GraphToolsService } from './graph-tools.service';
import { EntityRepository } from 'src/repositories/entity.repository';
import { RelationshipRepository } from 'src/repositories/relationship.repository';

describe('GraphToolsService', () => {
    let service: GraphToolsService;
    let mockEntityRepo: any;
    let mockRelationshipRepo: any;
    let mockConfig: any;

    beforeEach(async () => {
        mockEntityRepo = {
            search: jest.fn(),
            findById: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        };

        mockRelationshipRepo = {
            findBySourceOrTarget: jest.fn(),
            getNeighbors: jest.fn(),
            upsert: jest.fn(),
        };

        mockConfig = {
            get: jest.fn((key, defaultVal) => {
                if (key === 'GRAPH_MAX_NEIGHBOR_DEPTH') return 2;
                return defaultVal;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GraphToolsService,
                { provide: EntityRepository, useValue: mockEntityRepo },
                { provide: RelationshipRepository, useValue: mockRelationshipRepo },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();

        service = module.get<GraphToolsService>(GraphToolsService);
    });

    it('should return 6 structured graph tools', () => {
        const tools = service.getTools('org-1');
        expect(tools).toHaveLength(6);
        const toolNames = tools.map((t) => t.name);
        expect(toolNames).toEqual([
            'search_graph',
            'get_entity',
            'get_neighbors',
            'create_entities',
            'update_entities',
            'create_relationships',
        ]);
    });

    it('search_graph tool should invoke entityRepo.search', async () => {
        const tools = service.getTools('org-1');
        const searchTool = tools.find((t) => t.name === 'search_graph')!;

        mockEntityRepo.search.mockResolvedValue([
            { id: 'ent-1', name: 'ServiceA', type: 'Service' },
        ]);

        const result = await searchTool.invoke({ query: 'ServiceA', type: 'Service' });
        const parsed = JSON.parse(result);

        expect(mockEntityRepo.search).toHaveBeenCalledWith('org-1', 'ServiceA', 'Service');
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe('ent-1');
    });

    it('get_neighbors tool should clamp depth to max depth limit', async () => {
        const tools = service.getTools('org-1');
        const neighborsTool = tools.find((t) => t.name === 'get_neighbors')!;

        mockRelationshipRepo.getNeighbors.mockResolvedValue({
            rootEntity: { id: 'ent-1', name: 'ServiceA' },
            entities: [],
            relationships: [],
        });

        const result = await neighborsTool.invoke({ entityId: 'ent-1', depth: 5 });
        const parsed = JSON.parse(result);

        expect(mockRelationshipRepo.getNeighbors).toHaveBeenCalledWith('ent-1', 2);
        expect(parsed.rootEntity.id).toBe('ent-1');
    });

    it('create_entities tool should invoke entityRepo.upsert for each item', async () => {
        const tools = service.getTools('org-1');
        const createTool = tools.find((t) => t.name === 'create_entities')!;

        mockEntityRepo.upsert.mockResolvedValue({ id: 'ent-1', name: 'ServiceA', type: 'Service' });

        const result = await createTool.invoke({
            entities: [{ name: 'ServiceA', type: 'Service' }],
        });
        const parsed = JSON.parse(result);

        expect(mockEntityRepo.upsert).toHaveBeenCalledWith({
            organizationId: 'org-1',
            name: 'ServiceA',
            type: 'Service',
            metadata: undefined,
        });
        expect(parsed.createdOrMerged).toBe(1);
    });
});
