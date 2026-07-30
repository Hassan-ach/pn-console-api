import { Injectable, Logger } from '@nestjs/common';
import {
    EmbeddingRepository,
    SimilarityResult,
} from '../repositories/embedding.repository';
import { EmbeddingService } from '../intelligence/embeddings/embedding.service';

/** Maps user-facing keywords to DB insight types */
const TYPE_KEYWORDS: Record<string, string> = {
    info: 'INFO',
    information: 'INFO',
    informational: 'INFO',
    task: 'TASK',
    tasks: 'TASK',
    urgency: 'URGENCY',
    urgencies: 'URGENCY',
    urgent: 'URGENCY',
    decision: 'DECISION',
    decisions: 'DECISION',
};

/** Maps user-facing keywords to DB insight statuses */
const STATUS_KEYWORDS: Record<string, string> = {
    pending: 'PENDING',
    done: 'DONE',
    blocked: 'BLOCKED',
    noted: 'NOTED',
    'in review': 'IN_REVIEW',
    in_review: 'IN_REVIEW',
    decided: 'DECIDED',
    delegated: 'DELEGATED',
    delayed: 'DELAYED',
    hidden: 'HIDDEN',
};

@Injectable()
export class ChatContextService {
    private readonly logger = new Logger(ChatContextService.name);

    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingRepository: EmbeddingRepository,
    ) {}

    async buildContext(userId: string, userMessage?: string): Promise<string> {
        if (!userMessage) return '';

        return this.retrieveRelevantInsights(userMessage, userId);
    }

    /**
     * Extracts explicit type/status filters from the user message.
     * Returns null when no keywords are detected (pure semantic query).
     */
    private extractFilters(
        message: string,
    ): { types?: string[]; statuses?: string[] } | null {
        const lower = message.toLowerCase();

        const types = new Set<string>();
        const statuses = new Set<string>();

        for (const [keyword, type] of Object.entries(TYPE_KEYWORDS)) {
            // Use word-boundary matching to avoid e.g. "info" inside "information"
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(lower)) types.add(type);
        }

        for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
            const regex = new RegExp(
                `\\b${keyword.replace('_', '[_\\s]')}\\b`,
                'i',
            );
            if (regex.test(lower)) statuses.add(status);
        }

        if (types.size === 0 && statuses.size === 0) return null;

        return {
            types: types.size > 0 ? [...types] : undefined,
            statuses: statuses.size > 0 ? [...statuses] : undefined,
        };
    }

    private async retrieveRelevantInsights(
        userMessage: string,
        userId: string,
    ): Promise<string> {
        try {
            const now = new Date();
            const filters = this.extractFilters(userMessage);

            // --- Structured filter query (runs when type/status keywords detected) ---
            let filterResults: SimilarityResult[] = [];
            if (filters) {
                this.logger.debug(
                    `Filter keywords detected: ${JSON.stringify(filters)}`,
                );
                filterResults = await this.embeddingRepository.findByFilters(
                    userId,
                    50,
                    filters,
                );
                this.logger.debug(
                    `Filter query returned ${filterResults.length} results`,
                );
            }

            // --- Semantic search (always runs for contextual understanding) ---
            const embedding = await this.embeddingService.embed(userMessage);

            let semanticResults = await this.embeddingRepository.searchSimilar(
                embedding,
                10,
                userId,
                0.65,
            );

            // Fallback to a lower threshold when semantic returns nothing
            if (semanticResults.length === 0) {
                this.logger.debug(
                    'No semantic results above 0.65 — retrying with fallback 0.45',
                );
                semanticResults = await this.embeddingRepository.searchSimilar(
                    embedding,
                    5,
                    userId,
                    0.45,
                );
            }

            // --- Merge: filter results first (exact matches), semantic adds context ---
            const seen = new Set<string>();
            const combined: SimilarityResult[] = [];

            for (const r of [...filterResults, ...semanticResults]) {
                if (!seen.has(r.insightVersionId)) {
                    seen.add(r.insightVersionId);
                    combined.push(r);
                }
            }

            // Fallback: when no insights matched semantically or by filter,
            // return the most recent insights so the LLM has something to work with
            // (e.g. for broad queries like "Summarize my day")
            if (combined.length === 0) {
                this.logger.debug(
                    'No RAG results — fetching recent insights as fallback',
                );
                const recent = await this.embeddingRepository.findByFilters(
                    userId,
                    10,
                    {},
                );
                if (recent.length === 0) return '';
                combined.push(...recent);
            }

            const nowIso = now.toISOString();
            const lines = combined.map((r) => this.formatInsightLine(r, now));

            return `## Current Date\n\n${nowIso}\n\n## Relevant Insights\n\n${lines.join('\n')}`;
        } catch (error) {
            this.logger.warn(
                `Failed to retrieve relevant insights: ${(error as Error).message}`,
            );
            return '';
        }
    }

    private formatInsightLine(r: SimilarityResult, now: Date): string {
        // Source: plugin + most-specific scope (channel > topic > group)
        let source = '';
        if (r.sourcePlugin) {
            source = ` from ${r.sourcePlugin}`;
            if (r.channelId) source += `/${r.channelId}`;
            else if (r.topicId) source += `/${r.topicId}`;
            else if (r.groupId) source += `/${r.groupId}`;
        }

        // Creation date
        const createdLabel = ` [created: ${r.createdAt.toISOString().split('T')[0]}]`;

        // Deadline with human-readable urgency label
        let deadlineLabel = '';
        if (r.deadline) {
            const deadlineIso = r.deadline.toISOString().split('T')[0];
            const daysLeft = Math.round(
                (r.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (daysLeft < 0) {
                deadlineLabel = ` [deadline: ${deadlineIso} — OVERDUE by ${Math.abs(daysLeft)} day(s)]`;
            } else if (daysLeft === 0) {
                deadlineLabel = ` [deadline: ${deadlineIso} — DUE TODAY]`;
            } else {
                deadlineLabel = ` [deadline: ${deadlineIso} — in ${daysLeft} day(s)]`;
            }
        }

        let line = `- **${r.type}**`;
        if (r.status) line += ` [${r.status}]`;
        if (r.priority != null) line += ` (priority: ${r.priority}/10)`;
        line += `${source}${createdLabel}${deadlineLabel}: ${r.content}`;
        return line;
    }
}
