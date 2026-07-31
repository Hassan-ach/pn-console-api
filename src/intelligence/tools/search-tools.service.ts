import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnvelopeRepository } from 'src/repositories/envelope.repository';
import { InsightRepository } from 'src/repositories/insight.repository';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { EmbeddingService } from '../embeddings/embedding.service';

@Injectable()
export class SearchToolsService {
    private readonly logger = new Logger(SearchToolsService.name);

    constructor(
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly insightRepo: InsightRepository,
        private readonly embeddingRepo: EmbeddingRepository,
        private readonly embeddingService: EmbeddingService,
        private readonly platformUserMappingRepo: PlatformUserMappingRepository,
        private readonly userRepo: UserRepository,
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
                    .describe(
                        'Maximum number of message results to return (default: 15)',
                    ),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 15;
                this.logger.debug(
                    `[Tool Exec: search_raw_messages] query="${query}", limit=${maxResults}`,
                );

                try {
                    const results = await this.envelopeRepo.searchMessages(
                        query,
                        maxResults,
                    );
                    this.logger.debug(
                        `[Tool Result: search_raw_messages] Found ${results.length} raw messages (${Date.now() - start}ms)`,
                    );
                    return JSON.stringify(results);
                } catch (error) {
                    this.logger.error(
                        `[Tool Failure: search_raw_messages] ${(error as Error).message}`,
                        (error as Error).stack,
                    );
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
                    .describe(
                        'Maximum number of insights to return (default: 15)',
                    ),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 15;
                this.logger.debug(
                    `[Tool Exec: search_insights] query="${query}", limit=${maxResults}, orgId="${organizationId ?? 'none'}"`,
                );

                try {
                    const results = await this.insightRepo.searchInsights(
                        query,
                        organizationId,
                        maxResults,
                    );
                    this.logger.debug(
                        `[Tool Result: search_insights] Found ${results.length} insights (${Date.now() - start}ms)`,
                    );
                    return JSON.stringify(results);
                } catch (error) {
                    this.logger.error(
                        `[Tool Failure: search_insights] ${(error as Error).message}`,
                        (error as Error).stack,
                    );
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
                    .describe(
                        'Number of top semantically matching insights to return (default: 10)',
                    ),
            }),
            func: async ({ query, limit }) => {
                const start = Date.now();
                const maxResults = limit ?? 10;
                this.logger.debug(
                    `[Tool Exec: retrieve_relevant_insights] query="${query}", limit=${maxResults}, userId="${userId ?? 'none'}"`,
                );

                try {
                    const embedding = await this.embeddingService.embed(query);
                    const results = await this.embeddingRepo.searchSimilar(
                        embedding,
                        maxResults,
                        userId,
                        0.45,
                    );
                    this.logger.debug(
                        `[Tool Result: retrieve_relevant_insights] Retrieved ${results.length} similar insights via vector search (${Date.now() - start}ms)`,
                    );
                    return JSON.stringify(results);
                } catch (err) {
                    this.logger.error(
                        `[Tool Failure: retrieve_relevant_insights] ${(err as Error).message}`,
                        (err as Error).stack,
                    );
                    return JSON.stringify({ error: (err as Error).message });
                }
            },
        });

        const resolveUserByPlatformIdTool = new DynamicStructuredTool({
            name: 'resolve_user_by_platform_id',
            description:
                'Lookup and resolve a user name and app account details from their source platform user ID (e.g. Telegram account ID, Slack user ID) using the platform user mapping database table.',
            schema: z.object({
                platformUserId: z
                    .string()
                    .describe(
                        'The source platform user/account ID to resolve (e.g. "123456789" or "U12345")',
                    ),
                pluginName: z
                    .string()
                    .optional()
                    .describe(
                        'Optional source plugin/platform name (e.g. "telegram", "slack", "discord")',
                    ),
            }),
            func: async ({ platformUserId, pluginName }) => {
                const start = Date.now();
                this.logger.debug(
                    `[Tool Exec: resolve_user_by_platform_id] platformUserId="${platformUserId}", pluginName="${pluginName ?? 'ALL'}"`,
                );

                try {
                    const results =
                        await this.platformUserMappingRepo.resolvePlatformUser(
                            platformUserId,
                            pluginName,
                        );
                    this.logger.debug(
                        `[Tool Result: resolve_user_by_platform_id] Resolved ${results.length} user mapping(s) (${Date.now() - start}ms)`,
                    );
                    return JSON.stringify(results);
                } catch (error) {
                    this.logger.error(
                        `[Tool Failure: resolve_user_by_platform_id] ${(error as Error).message}`,
                        (error as Error).stack,
                    );
                    return JSON.stringify({ error: (error as Error).message });
                }
            },
        });

        const getCurrentUserTool = userId
            ? new DynamicStructuredTool({
                  name: 'get_current_user',
                  description:
                      'Get the profile details (name, email) and connected platform usernames/accounts (Telegram, Slack, Discord, etc.) of the currently logged-in user.',
                  schema: z.object({}),
                  func: async () => {
                      const start = Date.now();
                      this.logger.debug(
                          `[Tool Exec: get_current_user] userId="${userId}"`,
                      );

                      try {
                          const [user, mappings] = await Promise.all([
                              this.userRepo.findById(userId),
                              this.platformUserMappingRepo.findByAppUser(
                                  userId,
                              ),
                          ]);

                          if (!user) {
                              return JSON.stringify({
                                  error: `User with ID ${userId} not found`,
                              });
                          }

                          const result = {
                              id: user.id,
                              firstName: user.firstName,
                              lastName: user.lastName,
                              email: user.email,
                              organizationId: user.organizationId,
                              providerType: user.providerType,
                              createdAt: user.createdAt,
                              platformMappings: mappings.map((m) => ({
                                  pluginName: m.pluginName,
                                  platformUserId: m.platformUserId,
                                  platformUsername: m.platformUsername,
                              })),
                          };

                          this.logger.debug(
                              `[Tool Result: get_current_user] Retrieved profile for ${user.email} (${Date.now() - start}ms)`,
                          );
                          return JSON.stringify(result);
                      } catch (error) {
                          this.logger.error(
                              `[Tool Failure: get_current_user] ${(error as Error).message}`,
                              (error as Error).stack,
                          );
                          return JSON.stringify({
                              error: (error as Error).message,
                          });
                      }
                  },
              })
            : null;

        const tools: StructuredTool[] = [
            searchRawMessagesTool,
            searchInsightsTool,
            retrieveRelevantInsightsTool,
            resolveUserByPlatformIdTool,
        ];

        if (getCurrentUserTool) {
            tools.push(getCurrentUserTool);
        }

        return tools;
    }
}
