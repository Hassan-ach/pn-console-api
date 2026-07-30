import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnvelopeRepository } from 'src/repositories/envelope.repository';
import { InsightRepository } from 'src/repositories/insight.repository';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { EmbeddingService } from '../embeddings/embedding.service';

@Injectable()
export class SearchToolsService {
    private readonly logger = new Logger(SearchToolsService.name);

    constructor(
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly insightRepo: InsightRepository,
        private readonly embeddingRepo: EmbeddingRepository,
        private readonly embeddingService: EmbeddingService,
    ) {}

    getTools(organizationId?: string, userId?: string): StructuredTool[] {
        const searchRawMessagesTool = new DynamicStructuredTool({
            name: 'search_raw_messages',
            description:
                'Perform a text keyword search over raw ingested communication messages across all channels and plugins.',
            schema: z.object({
                query: z
                    .string()
                    .describe(
                        'Keyword or text phrase to search for in raw message content',
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe('Maximum number of message results to return (default: 15)'),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 15;
                this.logger.debug(`[Tool Exec: search_raw_messages] query="${query}", limit=${maxResults}`);

                try {
                    const results = await this.envelopeRepo.searchMessages(
                        query,
                        maxResults,
                    );
                    this.logger.debug(`[Tool Result: search_raw_messages] Found ${results.length} raw messages (${Date.now() - start}ms)`);
                    return JSON.stringify(results);
                } catch (error) {
                    this.logger.error(`[Tool Failure: search_raw_messages] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const searchInsightsTool = new DynamicStructuredTool({
            name: 'search_insights',
            description:
                'Search existing extracted business insights by text keyword to find previous tasks, urgencies, decisions, or info items.',
            schema: z.object({
                query: z
                    .string()
                    .describe(
                        'Keyword or text phrase to search for in existing insights',
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe('Maximum number of insights to return (default: 15)'),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 15;
                this.logger.debug(`[Tool Exec: search_insights] query="${query}", limit=${maxResults}, orgId="${organizationId ?? 'none'}"`);

                try {
                    const results = await this.insightRepo.searchInsights(
                        query,
                        organizationId,
                        maxResults,
                    );
                    this.logger.debug(`[Tool Result: search_insights] Found ${results.length} insights (${Date.now() - start}ms)`);
                    return JSON.stringify(results);
                } catch (error) {
                    this.logger.error(`[Tool Failure: search_insights] ${(error as Error).message}`, (error as Error).stack);
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const retrieveRelevantInsightsTool = new DynamicStructuredTool({
            name: 'retrieve_relevant_insights',
            description:
                'RAG Tool: Perform vector similarity search to retrieve semantically relevant prior insights based on a topic or query statement.',
            schema: z.object({
                query: z
                    .string()
                    .describe(
                        'Semantic query or context statement to find matching prior insights for',
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe('Number of top semantically matching insights to return (default: 10)'),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 10;
                this.logger.debug(`[Tool Exec: retrieve_relevant_insights] query="${query}", limit=${maxResults}, userId="${userId ?? 'none'}"`);

                try {
                    const embedding = await this.embeddingService.embed(query);
                    const results = await this.embeddingRepo.searchSimilar(
                        embedding,
                        maxResults,
                        userId,
                        0.45,
                    );
                    this.logger.debug(`[Tool Result: retrieve_relevant_insights] Retrieved ${results.length} similar insights via vector search (${Date.now() - start}ms)`);
                    return JSON.stringify(results);
                } catch (err) {
                    this.logger.error(`[Tool Failure: retrieve_relevant_insights] ${(err as Error).message}`, (err as Error).stack);
                    return JSON.stringify({ error: (err as Error).message });
                }
            },
        });

        return [
            searchRawMessagesTool,
            searchInsightsTool,
            retrieveRelevantInsightsTool,
        ];
    }
}
