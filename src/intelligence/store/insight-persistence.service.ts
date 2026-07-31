import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InsightRepository } from 'src/repositories/insight.repository';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { Insight } from 'src/types/insight.types';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import { Events } from 'src/common/providers/event-bus/events.registry';

@Injectable()
export class InsightPersistenceService implements OnModuleInit {
    private readonly logger = new Logger(InsightPersistenceService.name);

    constructor(
        private readonly repo: InsightRepository,
        private readonly embeddingRepository: EmbeddingRepository,
        @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.triggerMissingEmbeddingsBackfill();
    }

    async triggerMissingEmbeddingsBackfill(): Promise<void> {
        try {
            const nullVersions =
                await this.embeddingRepository.findNullEmbeddings(50);
            if (nullVersions.length === 0) return;

            this.logger.log(
                `Found ${nullVersions.length} insight_versions with missing embeddings; dispatching background event...`,
            );

            const items = nullVersions.map((v) => ({
                versionId: v.id,
                content: v.content,
            }));

            this.eventBus.publish(Events.EMBEDDINGS_GENERATE, { items });
        } catch (error) {
            this.logger.warn(
                `Failed to query missing embeddings for backfill event: ${(error as Error).message}`,
            );
        }
    }

    async persistAll(
        insights: Insight[],
        organizationId: string,
    ): Promise<void> {
        if (insights.length === 0) return;

        const newCount = insights.filter((i) => i.id === null).length;
        const updateCount = insights.filter((i) => i.id !== null).length;
        this.logger.log(
            `Persisting ${insights.length} insights (${newCount} new, ${updateCount} updates)`,
        );

        const persisted = await Promise.all(
            insights.map((insight) => {
                if (insight.id === null) {
                    return this.repo.create({
                        organizationId,
                        type: insight.type,
                        content: insight.content,
                        owners: insight.owners,
                        unresolvedOwners: insight.unresolvedOwnerRefs ?? [],
                        envolopsRef: insight.envolopsRef,
                        broadcasted: insight.broadcasted,
                        excludedUserIds: insight.excludedUserIds,
                        priority: insight.priority,
                        deadline: insight.deadline,
                        sourcePlugin: insight.sourcePlugin,
                        groupId: insight.groupId,
                        channelId: insight.channelId,
                        topicId: insight.topicId,
                    });
                }

                return this.repo.update(insight.id, {
                    type: insight.type,
                    content: insight.content,
                    owners: insight.owners,
                    unresolvedOwners: insight.unresolvedOwnerRefs ?? [],
                    envolopsRef: insight.envolopsRef,
                    broadcasted: insight.broadcasted,
                    excludedUserIds: insight.excludedUserIds,
                    priority: insight.priority,
                    deadline: insight.deadline,
                    sourcePlugin: insight.sourcePlugin,
                    groupId: insight.groupId,
                    channelId: insight.channelId,
                    topicId: insight.topicId,
                });
            }),
        );

        // Dispatch background embedding generation event
        const itemsToEmbed = persisted
            .filter(
                (i): i is Insight & { latestVersionId: string } =>
                    !!i.latestVersionId,
            )
            .map((i) => ({ versionId: i.latestVersionId, content: i.content }));

        if (itemsToEmbed.length > 0) {
            this.logger.debug(
                `Publishing 'insight.versions.created' event for ${itemsToEmbed.length} items to process in background`,
            );
            this.eventBus.publish(Events.INSIGHT_VERSIONS_CREATED, {
                items: itemsToEmbed,
            });
        }

        this.logger.log(`Persistence complete: ${insights.length} insights`);
    }

    async persist(insight: Insight, organizationId: string): Promise<void> {
        return this.persistAll([insight], organizationId);
    }
}
