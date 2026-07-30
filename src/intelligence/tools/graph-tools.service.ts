import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EntityRepository } from 'src/repositories/entity.repository';
import { RelationshipRepository } from 'src/repositories/relationship.repository';

@Injectable()
export class GraphToolsService {
    private readonly defaultMaxDepth: number;

    constructor(
        private readonly entityRepo: EntityRepository,
        private readonly relationshipRepo: RelationshipRepository,
        private readonly config: ConfigService,
    ) {
        this.defaultMaxDepth = this.config.get<number>(
            'GRAPH_MAX_NEIGHBOR_DEPTH',
            2,
        );
    }

    getTools(organizationId?: string): StructuredTool[] {
        const searchGraphTool = new DynamicStructuredTool({
            name: 'search_graph',
            description:
                'Search entities in the enterprise knowledge graph by name or keyword, optionally filtered by type (e.g. Person, Team, Project, Service, Repository, Document, Ticket, Channel).',
            schema: z.object({
                query: z.string().describe('Search query term or entity name'),
                type: z
                    .string()
                    .optional()
                    .describe('Optional entity type filter'),
            }),
            func: async ({ query, type }) => {
                const entities = await this.entityRepo.search(
                    organizationId,
                    query,
                    type,
                );
                return JSON.stringify(entities);
            },
        });

        const getEntityTool = new DynamicStructuredTool({
            name: 'get_entity',
            description:
                'Get detailed information about a specific entity and its direct relationships by entity ID.',
            schema: z.object({
                id: z.string().describe('The UUID of the entity'),
            }),
            func: async ({ id }) => {
                const entity = await this.entityRepo.findById(id);
                if (!entity) {
                    return JSON.stringify({ error: `Entity with ID ${id} not found` });
                }
                const relationships =
                    await this.relationshipRepo.findBySourceOrTarget(id);
                return JSON.stringify({ entity, relationships });
            },
        });

        const getNeighborsTool = new DynamicStructuredTool({
            name: 'get_neighbors',
            description:
                'Retrieve connected neighboring entities and relationships for a target entity ID up to a max depth limit.',
            schema: z.object({
                entityId: z
                    .string()
                    .describe('The UUID of the root entity'),
                depth: z
                    .number()
                    .optional()
                    .describe('Traversal depth (1 or 2 hops)'),
            }),
            func: async ({ entityId, depth }) => {
                const requestedDepth = depth ?? 1;
                const effectiveDepth = Math.min(
                    Math.max(1, requestedDepth),
                    this.defaultMaxDepth,
                );
                const neighborhood = await this.relationshipRepo.getNeighbors(
                    entityId,
                    effectiveDepth,
                );
                if (!neighborhood) {
                    return JSON.stringify({
                        error: `Root entity with ID ${entityId} not found`,
                    });
                }
                return JSON.stringify(neighborhood);
            },
        });

        const createEntitiesTool = new DynamicStructuredTool({
            name: 'create_entities',
            description:
                'Create or merge entities into the enterprise knowledge graph.',
            schema: z.object({
                entities: z.array(
                    z.object({
                        name: z.string().describe('Entity name'),
                        type: z
                            .string()
                            .describe(
                                'Entity type (Person, Team, Project, Service, Repository, Document, Ticket, Channel)',
                            ),
                        metadata: z
                            .record(z.string(), z.any())
                            .optional()
                            .describe('Optional metadata key-value object'),
                    }),
                ),
            }),
            func: async ({ entities }) => {
                const results: any[] = [];
                for (const e of entities) {
                    const saved = await this.entityRepo.upsert({
                        organizationId,
                        name: e.name,
                        type: e.type,
                        metadata: e.metadata,
                    });
                    results.push(saved);
                }
                return JSON.stringify({ createdOrMerged: results.length, entities: results });
            },
        });

        const updateEntitiesTool = new DynamicStructuredTool({
            name: 'update_entities',
            description: 'Update existing entities in the knowledge graph.',
            schema: z.object({
                updates: z.array(
                    z.object({
                        id: z.string().describe('Entity UUID'),
                        name: z.string().optional(),
                        type: z.string().optional(),
                        metadata: z.record(z.string(), z.any()).optional(),
                    }),
                ),
            }),
            func: async ({ updates }) => {
                const updated: any[] = [];
                for (const u of updates) {
                    const res = await this.entityRepo.update(u.id, {
                        name: u.name,
                        type: u.type,
                        metadata: u.metadata,
                    });
                    updated.push(res);
                }
                return JSON.stringify({ updatedCount: updated.length, updated });
            },
        });

        const createRelationshipsTool = new DynamicStructuredTool({
            name: 'create_relationships',
            description:
                'Create or update relationships between entities in the knowledge graph.',
            schema: z.object({
                relationships: z.array(
                    z.object({
                        sourceEntityId: z.string().describe('Source entity UUID'),
                        targetEntityId: z.string().describe('Target entity UUID'),
                        type: z
                            .string()
                            .describe(
                                'Relationship type (WORKS_ON, OWNS, DEPENDS_ON, REFERENCES, BELONGS_TO, MENTIONS)',
                            ),
                        metadata: z.record(z.string(), z.any()).optional(),
                    }),
                ),
            }),
            func: async ({ relationships }) => {
                const results: any[] = [];
                for (const r of relationships) {
                    const saved = await this.relationshipRepo.upsert({
                        organizationId,
                        sourceEntityId: r.sourceEntityId,
                        targetEntityId: r.targetEntityId,
                        type: r.type,
                        metadata: r.metadata,
                    });
                    results.push(saved);
                }
                return JSON.stringify({ createdOrMerged: results.length, relationships: results });
            },
        });

        return [
            searchGraphTool,
            getEntityTool,
            getNeighborsTool,
            createEntitiesTool,
            updateEntitiesTool,
            createRelationshipsTool,
        ];
    }
}
