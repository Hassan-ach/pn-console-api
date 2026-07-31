import { Injectable, Logger, Optional } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';
import { LlmService } from '../../llm/llm.service';
import { EntityRepository } from 'src/repositories/entity.repository';
import { RelationshipRepository } from 'src/repositories/relationship.repository';
import { Neo4jService } from 'src/graph/neo4j.service';
import { SYSTEM_PROMPT } from './kg-extraction-prompt';
import { KnowledgeGraphSchema, KnowledgeGraphData } from './kg-schema';

function extractJsonString(raw: unknown): string {
    let str = '';
    if (typeof raw === 'string') {
        str = raw;
    } else if (Array.isArray(raw)) {
        str = raw
            .map((item) =>
                typeof item === 'string' ? item : JSON.stringify(item),
            )
            .join('\n');
    } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (typeof obj.output === 'string') {
            str = obj.output;
        } else if (typeof obj.content === 'string') {
            str = obj.content;
        } else {
            str = JSON.stringify(raw);
        }
    }

    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim()) {
        const blockContent = codeBlockMatch[1].trim();
        const start = blockContent.indexOf('{');
        const end = blockContent.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return blockContent.substring(start, end + 1).trim();
        }
        return blockContent;
    }

    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return str.substring(firstBrace, lastBrace + 1).trim();
    }

    return str.trim();
}

@Injectable()
export class KnowledgeGraphExtractionCapability implements ICapability {
    readonly name = 'knowledge-graph-extractor';

    private readonly logger = new Logger(
        KnowledgeGraphExtractionCapability.name,
    );

    constructor(
        private readonly llmService: LlmService,
        private readonly entityRepo: EntityRepository,
        private readonly relationshipRepo: RelationshipRepository,
        @Optional() private readonly neo4jService?: Neo4jService,
    ) {}

    async execute(input: CapabilityInput): Promise<CapabilityResult> {
        const envelopes = input.chunk.envelopes;
        if (!envelopes || envelopes.length === 0) {
            this.logger.debug('No envelopes in chunk; skipping KG extraction');
            return { capabilityName: this.name, insights: [] };
        }

        const messages = envelopes.map((env) => ({
            envelopeId: env.envelope.id ?? '',
            sourcePlugin: env.envelope.sourcePlugin,
            content: env.payload.content,
            authorId: env.envelope.authorId,
            groupId: env.payload.groupId,
            channelId: env.payload.channelId,
            topicId: env.payload.topicId,
            occurredAt: env.envelope.occurredAt?.toISOString() ?? null,
        }));

        const orgId = envelopes[0]?.envelope.organizationId ?? 'org-1';

        this.logger.log(
            `Executing direct structured Knowledge Graph extraction on ${messages.length} envelopes (orgId: ${orgId})`,
        );

        const graphModel = await this.llmService.createGraphLLM();

        const inputMessages = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Messages to extract Knowledge Graph from:\n${JSON.stringify(messages, null, 2)}`,
            ),
        ];

        const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10);
        let extractedData: KnowledgeGraphData = {
            nodes: [],
            relationships: [],
        };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Try structured output first if supported by model, fallback to json parsing
                try {
                    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
                    const structuredLlm = (
                        graphModel as any
                    ).withStructuredOutput(KnowledgeGraphSchema, {
                        name: 'extract_knowledge_graph',
                    });
                    extractedData = await structuredLlm.invoke(inputMessages);
                    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
                } catch (structErr) {
                    this.logger.debug(
                        `Structured output fallback (attempt ${attempt}): ${(structErr as Error).message}`,
                    );
                    const response = await graphModel.invoke(inputMessages);
                    const rawJson = extractJsonString(response);
                    extractedData = KnowledgeGraphSchema.parse(
                        JSON.parse(rawJson),
                    );
                }

                this.logger.debug(
                    `Structured KG extraction attempt ${attempt} succeeded: ${extractedData.nodes.length} nodes, ${extractedData.relationships.length} relationships`,
                );
                break;
            } catch (error) {
                this.logger.warn(
                    `Structured KG extraction attempt ${attempt}/${MAX_RETRIES} failed: ${(error as Error).message}`,
                );
                if (attempt === MAX_RETRIES) {
                    this.logger.error(
                        `Structured KG extraction failed after ${MAX_RETRIES} attempts: ${(error as Error).message}`,
                        (error as Error).stack,
                    );
                }
            }
        }

        if (
            extractedData.nodes.length === 0 &&
            extractedData.relationships.length === 0
        ) {
            this.logger.debug('No nodes or relationships extracted; returning');
            return { capabilityName: this.name, insights: [] };
        }

        // 1. Write Node entities to PostgreSQL & Neo4j
        const nodeNameToId = new Map<string, string>();

        for (const node of extractedData.nodes) {
            try {
                const metadataObj: Record<string, any> = {};
                if (node.role) {
                    metadataObj.role = node.role;
                }

                const saved = await this.entityRepo.upsert({
                    organizationId: orgId,
                    name: node.name,
                    type: node.type,
                    metadata: metadataObj,
                });
                nodeNameToId.set(node.name.toLowerCase(), saved.id);

                // Neo4j direct MERGE query
                if (this.neo4jService?.getDriver()) {
                    try {
                        const label =
                            node.type.replace(/[^a-zA-Z0-9]/g, '') || 'Entity';
                        const roleStr = node.role ? String(node.role) : '';
                        const cypher = `
                            MERGE (n:${label} { id: $id })
                            SET n.name = $name,
                                n.orgId = $orgId,
                                n.role = $role,
                                n.updatedAt = datetime()
                            RETURN n
                        `;
                        await this.neo4jService.executeWrite(cypher, {
                            id: saved.id,
                            name: saved.name,
                            orgId,
                            role: roleStr,
                        });
                    } catch (neoErr) {
                        this.logger.error(
                            `Neo4j MERGE node error for ${node.name}: ${(neoErr as Error).message}`,
                            (neoErr as Error).stack,
                        );
                    }
                }
            } catch (err) {
                this.logger.error(
                    `Failed to save entity ${node.name}: ${(err as Error).message}`,
                    (err as Error).stack,
                );
            }
        }

        // 2. Write Relationships to PostgreSQL & Neo4j
        for (const rel of extractedData.relationships) {
            try {
                const sourceId = nodeNameToId.get(rel.sourceName.toLowerCase());
                const targetId = nodeNameToId.get(rel.targetName.toLowerCase());

                if (sourceId && targetId && sourceId !== targetId) {
                    const relType = rel.type.toUpperCase().trim();
                    await this.relationshipRepo.upsert({
                        organizationId: orgId,
                        sourceEntityId: sourceId,
                        targetEntityId: targetId,
                        type: relType,
                    });

                    // Neo4j direct MERGE relationship query
                    if (this.neo4jService?.getDriver()) {
                        try {
                            const neoRelType =
                                relType.replace(/[^a-zA-Z0-9_]/g, '') ||
                                'RELATED_TO';
                            const cypher = `
                                MATCH (a { id: $sourceId }), (b { id: $targetId })
                                MERGE (a)-[r:${neoRelType}]->(b)
                                SET r.updatedAt = datetime()
                                RETURN r
                            `;
                            await this.neo4jService.executeWrite(cypher, {
                                sourceId,
                                targetId,
                            });
                        } catch (neoErr) {
                            this.logger.error(
                                `Neo4j MERGE rel error (${rel.sourceName} -> ${rel.targetName}): ${(neoErr as Error).message}`,
                                (neoErr as Error).stack,
                            );
                        }
                    }
                }
            } catch (err) {
                this.logger.error(
                    `Failed to save relationship ${rel.sourceName} -> ${rel.targetName}: ${(err as Error).message}`,
                    (err as Error).stack,
                );
            }
        }

        this.logger.log(
            `KG direct extraction persisted ${nodeNameToId.size} entities & ${extractedData.relationships.length} relationships`,
        );

        return { capabilityName: this.name, insights: [] };
    }
}
