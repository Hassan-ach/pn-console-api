import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
    EmbeddingsBatchEvent,
    Events,
} from 'src/common/providers/event-bus/events.registry';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';
import { EmbeddingService } from '../embeddings/embedding.service';

export { EmbeddingsBatchEvent };

@Injectable()
export class InsightEmbeddingListener {
    private readonly logger = new Logger(InsightEmbeddingListener.name);

    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingRepository: EmbeddingRepository,
    ) {}

    @OnEvent(Events.INSIGHT_VERSIONS_CREATED, { async: true })
    async handleVersionsCreated(event: EmbeddingsBatchEvent): Promise<void> {
        await this.processEmbeddingsWithRetry(event);
    }

    @OnEvent(Events.EMBEDDINGS_GENERATE, { async: true })
    async handleEmbeddingsGenerate(event: EmbeddingsBatchEvent): Promise<void> {
        await this.processEmbeddingsWithRetry(event);
    }

    private async processEmbeddingsWithRetry(
        event: EmbeddingsBatchEvent,
        maxRetries = 3,
        initialBackoffMs = 1000,
    ): Promise<void> {
        const { items } = event;
        if (!items || items.length === 0) return;

        this.logger.log(
            `[Background] Processing event-driven embedding generation for ${items.length} items...`,
        );

        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                attempt++;
                const contents = items.map((i) => i.content);
                const vectors =
                    await this.embeddingService.embedDocuments(contents);

                let successCount = 0;
                await Promise.all(
                    items.map(async (item, idx) => {
                        if (vectors[idx] && vectors[idx].length > 0) {
                            await this.embeddingRepository.upsert(
                                item.versionId,
                                vectors[idx],
                            );
                            successCount++;
                        }
                    }),
                );

                this.logger.log(
                    `[Background] Successfully generated & persisted ${successCount} embeddings in pgvector`,
                );
                return;
            } catch (error) {
                if (attempt >= maxRetries) {
                    this.logger.error(
                        `[Background Failure] Embedding generation failed after ${maxRetries} attempt(s): ${(error as Error).message}`,
                        (error as Error).stack,
                    );
                    return;
                }
                const backoff = initialBackoffMs * Math.pow(2, attempt - 1);
                this.logger.warn(
                    `[Background Retry] Embedding generation failed (attempt ${attempt}/${maxRetries}). Retrying in ${backoff}ms... Error: ${(error as Error).message}`,
                );
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }
}
