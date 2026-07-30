import { Injectable, Logger } from '@nestjs/common';
import { InsightRepository } from 'src/repositories/insight.repository';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { EmbeddingService } from '../embeddings/embedding.service';
import { Insight } from 'src/types/insight.types';

@Injectable()
export class InsightPersistenceService {
    private readonly logger = new Logger(InsightPersistenceService.name);

    constructor(
        private readonly repo: InsightRepository,
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingRepository: EmbeddingRepository,
    ) {}

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

        await this.generateEmbeddings(persisted);

        this.logger.log(`Persistence complete: ${insights.length} insights`);
    }

    async persist(insight: Insight, organizationId: string): Promise<void> {
        return this.persistAll([insight], organizationId);
    }

    private async generateEmbeddings(persisted: Insight[]): Promise<void> {
        const withVersionId = persisted.filter(
            (i): i is Insight & { latestVersionId: string } =>
                !!i.latestVersionId,
        );

        if (withVersionId.length === 0) return;

        const contents = withVersionId.map((i) => i.content);
        const versionIds = withVersionId.map((i) => i.latestVersionId);

        try {
            const embeddings =
                await this.embeddingService.embedDocuments(contents);

            await Promise.all(
                versionIds.map((versionId, idx) =>
                    this.embeddingRepository.upsert(versionId, embeddings[idx]),
                ),
            );

            this.logger.debug(
                `Generated and stored ${embeddings.length} embeddings`,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to generate embeddings: ${(error as Error).message}`,
            );
        }
    }
}
