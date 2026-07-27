import { Injectable } from '@nestjs/common';
import { InsightRepository } from '../repositories/insight.repository';
import { EnvelopeRepository } from '../repositories/envelope.repository';

@Injectable()
export class ChatContextService {
    constructor(
        private readonly insightRepository: InsightRepository,
        private readonly envelopeRepository: EnvelopeRepository,
    ) {}

    async buildContext(userId: string): Promise<string> {
        const [insights, envelopes] = await Promise.all([
            this.insightRepository.findByOwnerId(userId),
            this.envelopeRepository.findRecent(10),
        ]);

        const insightsSection = this.formatInsights(insights);
        const messagesSection = this.formatMessages(envelopes);

        return `${insightsSection}\n\n${messagesSection}`;
    }

    private formatInsights(
        insights: {
            id: string;
            type: string;
            content: string;
            status: string;
        }[],
    ): string {
        if (insights.length === 0) {
            return '## User Insights\n\nNo insights on file';
        }

        const lines = insights.map((i) => `- **${i.type}**: ${i.content}`);
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
