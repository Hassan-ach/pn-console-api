import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EntityRepository } from 'src/repositories/entity.repository';
import { RelationshipRepository } from 'src/repositories/relationship.repository';
import { Neo4jService } from 'src/graph/neo4j.service';

@Injectable()
export class GraphToolsService {
    private readonly logger = new Logger(GraphToolsService.name);
    private readonly defaultMaxDepth: number;

    constructor(
        private readonly entityRepo: EntityRepository,
        private readonly relationshipRepo: RelationshipRepository,
        private readonly config: ConfigService,
        @Optional() private readonly neo4jService?: Neo4jService,
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
                'Search entities in the enterprise knowledge graph by name or keyword, optionally filtered by type (e.g. Person, Team, Project, Service, Repository, Document, Ticket, Channel). Returns entity records including organizational roles.',
            schema: z.object({
                query: z.string().describe('Search query term or entity name'),
                type: z
                    .string()
                    .optional()
                    .describe('Optional entity type filter'),
            }),
            func: async ({ query, type }) => {
                const start = Date.now();
                this.logger.debug(`[Tool Exec: search_graph] query="${query}", type="${type ?? 'ALL'}", orgId="${organizationId ?? 'none'}"`);

                try {
                    // Query Neo4j if available
                    if (this.neo4jService?.getDriver()) {
                        try {
                            const cypher = `
                                MATCH (e)
                                WHERE (toLower(e.name) CONTAINS toLower($query) OR toLower(coalesce(e.role, '')) CONTAINS toLower($query))
                                ${type ? 'AND labels(e)[0] = $type' : ''}
                                RETURN e.id AS id, e.name AS name, labels(e)[0] AS type, e.role AS role, properties(e) AS metadata
                                LIMIT 20
                            `;
                            const neoResults = await this.neo4jService.executeRead(cypher, { query, type: type ?? '' });
                            if (neoResults.length > 0) {
                                this.logger.debug(`[Tool Result: search_graph] Returned ${neoResults.length} entities from Neo4j (${Date.now() - start}ms)`);
                                return JSON.stringify(neoResults);
                            }
                        } catch (neoErr) {
                            this.logger.warn(`[Tool Exec: search_graph] Neo4j query failed, falling back to Postgres: ${(neoErr as Error).message}`);
                        }
                    }

                    const entities = await this.entityRepo.search(
                        organizationId,
                        query,
                        type,
                    );
                    this.logger.debug(`[Tool Result: search_graph] Returned ${entities.length} entities from Postgres (${Date.now() - start}ms)`);
                    return JSON.stringify(entities);
                } catch (error) {
                    this.logger.error(`[Tool Failure: search_graph] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const getEntityTool = new DynamicStructuredTool({
            name: 'get_entity',
            description:
                'Get detailed information about a specific entity (including role, properties) and its direct relationships by entity ID.',
            schema: z.object({
                id: z.string().describe('The UUID of the entity'),
            }),
            func: async ({ id }) => {
                const start = Date.now();
                this.logger.debug(`[Tool Exec: get_entity] id="${id}"`);

                try {
                    if (this.neo4jService?.getDriver()) {
                        try {
                            const cypher = `
                                MATCH (e { id: $id })
                                OPTIONAL MATCH (e)-[r]-(other)
                                RETURN e.id AS id, e.name AS name, labels(e)[0] AS type, e.role AS role, properties(e) AS metadata,
                                       collect({ relationship: type(r), connectedId: other.id, connectedName: other.name }) AS relationships
                            `;
                            const neoResults = await this.neo4jService.executeRead(cypher, { id });
                            if (neoResults.length > 0 && neoResults[0].id) {
                                this.logger.debug(`[Tool Result: get_entity] Retrieved entity ${id} from Neo4j (${Date.now() - start}ms)`);
                                return JSON.stringify(neoResults[0]);
                            }
                        } catch (neoErr) {
                            this.logger.warn(`[Tool Exec: get_entity] Neo4j query failed, falling back to Postgres: ${(neoErr as Error).message}`);
                        }
                    }

                    const entity = await this.entityRepo.findById(id);
                    if (!entity) {
                        this.logger.warn(`[Tool Result: get_entity] Entity with ID ${id} not found`);
                        return JSON.stringify({
                            error: `Entity with ID ${id} not found`,
                        });
                    }
                    const relationships =
                        await this.relationshipRepo.findBySourceOrTarget(id);
                    this.logger.debug(`[Tool Result: get_entity] Retrieved entity ${id} with ${relationships.length} relationships from Postgres (${Date.now() - start}ms)`);
                    return JSON.stringify({ entity, relationships });
                } catch (error) {
                    this.logger.error(`[Tool Failure: get_entity] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const getNeighborsTool = new DynamicStructuredTool({
            name: 'get_neighbors',
            description:
                'Retrieve connected neighboring entities and relationships for a target entity ID up to a max depth limit.',
            schema: z.object({
                entityId: z.string().describe('The UUID of the root entity'),
                depth: z
                    .number()
                    .optional()
                    .describe('Traversal depth (1 or 2 hops)'),
            }),
            func: async ({ entityId, depth }) => {
                const start = Date.now();
                const requestedDepth = depth ?? 1;
                const effectiveDepth = Math.min(
                    Math.max(1, requestedDepth),
                    this.defaultMaxDepth,
                );
                this.logger.debug(`[Tool Exec: get_neighbors] entityId="${entityId}", depth=${effectiveDepth}`);

                try {
                    if (this.neo4jService?.getDriver()) {
                        try {
                            const cypher = `
                                MATCH path = (root { id: $entityId })-[*1..${effectiveDepth}]-(neighbor)
                                RETURN root.id AS rootId,
                                       [node IN nodes(path) | { id: node.id, name: node.name, type: labels(node)[0], role: node.role }] AS nodes,
                                       [rel IN relationships(path) | { type: type(rel), source: startNode(rel).id, target: endNode(rel).id }] AS relationships
                            `;
                            const neoResults = await this.neo4jService.executeRead(cypher, { entityId });
                            if (neoResults.length > 0) {
                                this.logger.debug(`[Tool Result: get_neighbors] Retrieved neighborhood from Neo4j (${Date.now() - start}ms)`);
                                return JSON.stringify(neoResults);
                            }
                        } catch (neoErr) {
                            this.logger.warn(`[Tool Exec: get_neighbors] Neo4j query failed, falling back to Postgres: ${(neoErr as Error).message}`);
                        }
                    }

                    const neighborhood = await this.relationshipRepo.getNeighbors(
                        entityId,
                        effectiveDepth,
                    );
                    if (!neighborhood) {
                        this.logger.warn(`[Tool Result: get_neighbors] Root entity with ID ${entityId} not found`);
                        return JSON.stringify({
                            error: `Root entity with ID ${entityId} not found`,
                        });
                    }
                    this.logger.debug(`[Tool Result: get_neighbors] Retrieved neighborhood from Postgres (${Date.now() - start}ms)`);
                    return JSON.stringify(neighborhood);
                } catch (error) {
                    this.logger.error(`[Tool Failure: get_neighbors] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const createEntitiesTool = new DynamicStructuredTool({
            name: 'create_entities',
            description:
                'Create or merge entities into the enterprise knowledge graph. IMPORTANT: For Person or Team entities, extract and include their organizational role in metadata (e.g. metadata: { "role": "DevOps Engineer" }).',
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
                            .describe(
                                'Optional metadata key-value object. For Person/Team, include "role" field specifying their position (e.g. {"role": "Lead Architect"})',
                            ),
                    }),
                ),
            }),
            func: async ({ entities }) => {
                const start = Date.now();
                this.logger.debug(`[Tool Exec: create_entities] count=${entities.length}`);

                try {
                    const results: any[] = [];
                    for (const e of entities) {
                        const saved = await this.entityRepo.upsert({
                            organizationId,
                            name: e.name,
                            type: e.type,
                            metadata: e.metadata,
                        });
                        results.push(saved);

                        // Sync to Neo4j if driver connected
                        if (this.neo4jService?.getDriver()) {
                            try {
                                const label = e.type.replace(/[^a-zA-Z0-9]/g, '') || 'Entity';
                                const roleStr = e.metadata?.role ? String(e.metadata.role) : '';
                                const cypher = `
                                    MERGE (e:${label} { id: $id })
                                    SET e.name = $name,
                                        e.orgId = $orgId,
                                        e.role = $role,
                                        e.updatedAt = datetime()
                                `;
                                await this.neo4jService.executeWrite(cypher, {
                                    id: saved.id,
                                    name: saved.name,
                                    orgId: organizationId ?? 'org-1',
                                    role: roleStr,
                                });
                            } catch (neoErr) {
                                this.logger.warn(`[Tool Exec: create_entities] Neo4j sync error for ${e.name}: ${(neoErr as Error).message}`);
                            }
                        }
                    }
                    this.logger.debug(`[Tool Result: create_entities] Successfully merged ${results.length} entities (${Date.now() - start}ms)`);
                    return JSON.stringify({
                        createdOrMerged: results.length,
                        entities: results,
                    });
                } catch (error) {
                    this.logger.error(`[Tool Failure: create_entities] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const updateEntitiesTool = new DynamicStructuredTool({
            name: 'update_entities',
            description: 'Update existing entities in the knowledge graph, including updating their organizational role metadata.',
            schema: z.object({
                updates: z.array(
                    z.object({
                        id: z.string().describe('Entity UUID'),
                        name: z.string().optional(),
                        type: z.string().optional(),
                        metadata: z
                            .record(z.string(), z.any())
                            .optional()
                            .describe('Optional metadata update object (e.g. {"role": "Senior Frontend Engineer"})'),
                    }),
                ),
            }),
            func: async ({ updates }) => {
                const start = Date.now();
                this.logger.debug(`[Tool Exec: update_entities] count=${updates.length}`);

                try {
                    const updated: any[] = [];
                    for (const u of updates) {
                        const res = await this.entityRepo.update(u.id, {
                            name: u.name,
                            type: u.type,
                            metadata: u.metadata,
                        });
                        updated.push(res);

                        if (this.neo4jService?.getDriver() && res) {
                            try {
                                const roleStr = u.metadata?.role ? String(u.metadata.role) : '';
                                const cypher = `
                                    MATCH (e { id: $id })
                                    SET e.name = coalesce($name, e.name),
                                        e.role = coalesce($role, e.role),
                                        e.updatedAt = datetime()
                                `;
                                await this.neo4jService.executeWrite(cypher, {
                                    id: u.id,
                                    name: u.name ?? null,
                                    role: roleStr || null,
                                });
                            } catch (neoErr) {
                                this.logger.warn(`[Tool Exec: update_entities] Neo4j update error for ${u.id}: ${(neoErr as Error).message}`);
                            }
                        }
                    }
                    this.logger.debug(`[Tool Result: update_entities] Updated ${updated.length} entities (${Date.now() - start}ms)`);
                    return JSON.stringify({
                        updatedCount: updated.length,
                        updated,
                    });
                } catch (error) {
                    this.logger.error(`[Tool Failure: update_entities] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const createRelationshipsTool = new DynamicStructuredTool({
            name: 'create_relationships',
            description:
                'Create or update relationships between entities in the knowledge graph.',
            schema: z.object({
                relationships: z.array(
                    z.object({
                        sourceEntityId: z
                            .string()
                            .describe('Source entity UUID'),
                        targetEntityId: z
                            .string()
                            .describe('Target entity UUID'),
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
                const start = Date.now();
                this.logger.debug(`[Tool Exec: create_relationships] count=${relationships.length}`);

                try {
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

                        if (this.neo4jService?.getDriver()) {
                            try {
                                const relType = r.type.replace(/[^a-zA-Z0-9_]/g, '') || 'RELATED_TO';
                                const cypher = `
                                    MATCH (a { id: $sourceId }), (b { id: $targetId })
                                    MERGE (a)-[r:${relType}]->(b)
                                    SET r.updatedAt = datetime()
                                `;
                                await this.neo4jService.executeWrite(cypher, {
                                    sourceId: r.sourceEntityId,
                                    targetId: r.targetEntityId,
                                });
                            } catch (neoErr) {
                                this.logger.warn(`[Tool Exec: create_relationships] Neo4j rel error: ${(neoErr as Error).message}`);
                            }
                        }
                    }
                    this.logger.debug(`[Tool Result: create_relationships] Created/merged ${results.length} relationships (${Date.now() - start}ms)`);
                    return JSON.stringify({
                        createdOrMerged: results.length,
                        relationships: results,
                    });
                } catch (error) {
                    this.logger.error(`[Tool Failure: create_relationships] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
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
