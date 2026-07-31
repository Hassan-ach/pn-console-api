import { Injectable, Logger, Optional } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { randomUUID } from 'node:crypto';
import {
    ICapability,
    CapabilityInput,
    CapabilityResult,
} from '../capability.interface';
import { LlmService } from '../../llm/llm.service';
import { Neo4jService } from 'src/graph/neo4j.service';
import { SYSTEM_PROMPT } from './kg-extraction-prompt';
import { KnowledgeGraphSchema, KnowledgeGraphData } from './kg-schema';

import { extractJsonString } from '../../utils/llm-response.utils';

@Injectable()
export class KnowledgeGraphExtractionCapability implements ICapability {
    readonly name = 'knowledge-graph-extractor';

    private readonly logger = new Logger(
        KnowledgeGraphExtractionCapability.name,
    );

    constructor(
        private readonly llmService: LlmService,
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

        // Write Node entities to Neo4j
        const nodeNameToId = new Map<string, string>();

        for (const node of extractedData.nodes) {
            try {
                const nodeId = randomUUID();
                const label =
                    node.type.replace(/[^a-zA-Z0-9]/g, '') || 'Entity';
                const roleStr = node.role ? String(node.role) : '';

                if (this.neo4jService?.getDriver()) {
                    const cypher = `
                        MERGE (n:${label} { name: $name, orgId: $orgId })
                        ON CREATE SET n.id = $id, n.role = $role, n.createdAt = datetime(), n.updatedAt = datetime()
                        ON MATCH SET n.role = case when $role <> '' then $role else n.role end, n.updatedAt = datetime()
                        RETURN n.id AS id
                    `;
                    const res = await this.neo4jService.executeWrite<{
                        id: string;
                    }>(cypher, {
                        id: nodeId,
                        name: node.name,
                        orgId,
                        role: roleStr,
                    });
                    const id = res?.[0]?.id ?? nodeId;
                    nodeNameToId.set(node.name.toLowerCase(), id);
                } else {
                    nodeNameToId.set(node.name.toLowerCase(), nodeId);
                }
            } catch (err) {
                this.logger.error(
                    `Failed to save entity ${node.name}: ${(err as Error).message}`,
                    (err as Error).stack,
                );
            }
        }

        // Write Relationships to Neo4j
        for (const rel of extractedData.relationships) {
            try {
                const sourceId = nodeNameToId.get(rel.sourceName.toLowerCase());
                const targetId = nodeNameToId.get(rel.targetName.toLowerCase());

                if (
                    sourceId &&
                    targetId &&
                    sourceId !== targetId &&
                    this.neo4jService?.getDriver()
                ) {
                    const relType = rel.type.toUpperCase().trim();
                    const neoRelType =
                        relType.replace(/[^a-zA-Z0-9_]/g, '') || 'RELATED_TO';
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
                }
            } catch (err) {
                this.logger.error(
                    `Failed to save relationship ${rel.sourceName} -> ${rel.targetName}: ${(err as Error).message}`,
                    (err as Error).stack,
                );
            }
        }

        this.logger.log(
            `KG direct extraction persisted ${nodeNameToId.size} entities & ${extractedData.relationships.length} relationships to Neo4j`,
        );

        return { capabilityName: this.name, insights: [] };
    }
}
