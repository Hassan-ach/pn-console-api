import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmbeddingService } from '../embeddings/embedding.service';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';

export interface EmbeddingsBatchEvent {
    items: Array<{
        versionId: string;
        content: string;
    }>;
}

@Injectable()
export class InsightEmbeddingListener {
    private readonly logger = new Logger(InsightEmbeddingListener.name);

    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingRepository: EmbeddingRepository,
    ) {}

    @OnEvent('insight.versions.created', { async: true })
    async handleVersionsCreated(event: EmbeddingsBatchEvent): Promise<void> {
        await this.processEmbeddings(event);
    }

    @OnEvent('embeddings.generate', { async: true })
    async handleEmbeddingsGenerate(event: EmbeddingsBatchEvent): Promise<void> {
        await this.processEmbeddings(event);
    }

    private async processEmbeddings(event: EmbeddingsBatchEvent): Promise<void> {
        const { items } = event;
        if (!items || items.length === 0) return;

        this.logger.log(
            `[Background] Processing event-driven embedding generation for ${items.length} items...`,
        );

        const contents = items.map((i) => i.content);
        try {
            const vectors = await this.embeddingService.embedDocuments(contents);

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
        } catch (error) {
            this.logger.error(
                `[Background Failure] Embedding generation failed: ${(error as Error).message}`,
                (error as Error).stack,
            );
        }
    }
}
