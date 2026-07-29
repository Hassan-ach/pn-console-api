import { Injectable, Logger } from '@nestjs/common';
import { InsightRepository } from '../repositories/insight.repository';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import { EmbeddingRepository } from '../repositories/embedding.repository';
import { EmbeddingService } from '../intelligence/embeddings/embedding.service';

@Injectable()
export class ChatContextService {
    private readonly logger = new Logger(ChatContextService.name);

    constructor(
        private readonly insightRepository: InsightRepository,
        private readonly envelopeRepository: EnvelopeRepository,
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingRepository: EmbeddingRepository,
    ) {}

    async buildContext(userId: string, userMessage?: string): Promise<string> {
        const [insights, envelopes] = await Promise.all([
            this.insightRepository.findByOwnerId(userId),
            this.envelopeRepository.findRecent(10),
        ]);

        const insightsSection = this.formatInsights(insights);
        const messagesSection = this.formatMessages(envelopes);

        let relevantSection = '';
        if (userMessage) {
            relevantSection = await this.retrieveRelevantInsights(
                userMessage,
                userId,
            );
        }

        return [insightsSection, messagesSection, relevantSection]
            .filter(Boolean)
            .join('\n\n');
    }

    private async retrieveRelevantInsights(
        userMessage: string,
        userId: string,
    ): Promise<string> {
        try {
            const embedding = await this.embeddingService.embed(userMessage);
            const results = await this.embeddingRepository.searchSimilar(
                embedding,
                5,
                userId,
            );

            if (results.length === 0) return '';

            const lines = results.map((r) => {
                let line = `- **${r.type}**`;
                if (r.status) line += ` [${r.status}]`;
                if (r.priority != null) line += ` (priority: ${r.priority})`;
                line += ` (relevance: ${(r.similarity * 100).toFixed(0)}%): ${r.content}`;
                return line;
            });
            return `## Relevant Insights\n\n${lines.join('\n')}`;
        } catch (error) {
            this.logger.warn(
                `Failed to retrieve relevant insights: ${(error as Error).message}`,
            );
            return '';
        }
    }

    private formatInsights(
        insights: {
            id: string;
            type: string;
            content: string;
            status: string;
            priority: number;
            deadline?: Date;
        }[],
    ): string {
        if (insights.length === 0) {
            return '## User Insights\n\nNo insights on file';
        }

        const lines = insights.map((i) => {
            let line = `- **${i.type}** [${i.status}] (priority: ${i.priority})`;
            if (i.deadline) {
                const d =
                    i.deadline instanceof Date
                        ? i.deadline.toISOString().split('T')[0]
                        : String(i.deadline).split('T')[0];
                line += ` deadline: ${d}`;
            }
            line += `: ${i.content}`;
            return line;
        });
        return `## User Insights\n\n${lines.join('\n')}`;
    }

    private formatMessages(
        envelopes: {
            sourcePlugin: string;
            occurredAt: Date;
            content: string;
        }[],
    ): string {
        if (envelopes.length === 0) {
            return '## Recent Ingested Messages\n\nNo recent messages';
        }

        const lines = envelopes.map(
            (e) =>
                `- **${e.sourcePlugin}** (${e.occurredAt.toISOString()}): ${e.content}`,
        );
        return `## Recent Ingested Messages\n\n${lines.join('\n')}`;
    }
}
