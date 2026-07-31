/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { GraphToolsService } from './graph-tools.service';
import { Neo4jService } from 'src/graph/neo4j.service';

type GraphTool = {
    invoke: (input: Record<string, unknown>) => Promise<string>;
};

describe('GraphToolsService', () => {
    let service: GraphToolsService;
    let mockNeo4jService: jest.Mocked<Neo4jService>;
    let mockConfig: jest.Mocked<ConfigService>;

    beforeEach(async () => {
        mockNeo4jService = {
            getDriver: jest.fn().mockReturnValue({}),
            getGraph: jest.fn(),
            executeRead: jest.fn(),
            executeWrite: jest.fn(),
        } as unknown as jest.Mocked<Neo4jService>;

        mockConfig = {
            get: jest.fn(<T>(_key: string, defaultVal?: T) => {
                if (_key === 'GRAPH_MAX_NEIGHBOR_DEPTH') return 2 as T;
                return defaultVal;
            }),
        } as unknown as jest.Mocked<ConfigService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GraphToolsService,
                { provide: Neo4jService, useValue: mockNeo4jService },
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

    it('search_graph tool should invoke Neo4j executeRead', async () => {
        const tools = service.getTools('org-1');
        const searchTool = tools.find(
            (t) => t.name === 'search_graph',
        ) as GraphTool;

        mockNeo4jService.executeRead.mockResolvedValue([
            { id: 'ent-1', name: 'ServiceA', type: 'Service' },
        ]);

        const result = await searchTool.invoke({
            query: 'ServiceA',
            type: 'Service',
        });
        const parsed = JSON.parse(result) as Array<{ id: string }>;

        expect(mockNeo4jService.executeRead).toHaveBeenCalled();
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe('ent-1');
    });

    it('get_neighbors tool should invoke Neo4j executeRead with clamped depth', async () => {
        const tools = service.getTools('org-1');
        const neighborsTool = tools.find(
            (t) => t.name === 'get_neighbors',
        ) as GraphTool;

        mockNeo4jService.executeRead.mockResolvedValue([
            {
                rootId: 'ent-1',
                nodes: [{ id: 'ent-1', name: 'ServiceA' }],
                relationships: [],
            },
        ]);

        const result = await neighborsTool.invoke({
            entityId: 'ent-1',
            depth: 5,
        });
        const parsed = JSON.parse(result) as Array<{ rootId: string }>;

        expect(mockNeo4jService.executeRead).toHaveBeenCalled();
        expect(parsed[0].rootId).toBe('ent-1');
    });

    it('create_entities tool should invoke Neo4j executeWrite for each item', async () => {
        const tools = service.getTools('org-1');
        const createTool = tools.find(
            (t) => t.name === 'create_entities',
        ) as GraphTool;

        mockNeo4jService.executeWrite.mockResolvedValue([
            {
                id: 'ent-1',
                name: 'ServiceA',
                type: 'Service',
            },
        ]);

        const result = await createTool.invoke({
            entities: [{ name: 'ServiceA', type: 'Service' }],
        });
        const parsed = JSON.parse(result) as { createdOrMerged: number };

        expect(mockNeo4jService.executeWrite).toHaveBeenCalled();
        expect(parsed.createdOrMerged).toBe(1);
    });

    it('should not emit Gemini-rejected propertyNames in any tool schema', () => {
        const tools = service.getTools('org-1');
        for (const tool of tools) {
            const raw = JSON.stringify(toJsonSchema(tool.schema));
            expect(raw).not.toContain('propertyNames');
        }
    });
});
