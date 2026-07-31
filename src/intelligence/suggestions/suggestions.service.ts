import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InsightSuggestionRepository } from 'src/repositories/insight-suggestion.repository';
import { InsightRepository } from 'src/repositories/insight.repository';
import { CapabilityManager } from '../capabilities/capability-manager.service';
import { SuggestionStatus } from 'generated/app-db-client';

@Injectable()
export class SuggestionsService {
    private readonly logger = new Logger(SuggestionsService.name);

    constructor(
        private readonly suggestionRepo: InsightSuggestionRepository,
        private readonly insightRepo: InsightRepository,
        private readonly capabilityManager: CapabilityManager,
    ) {}

    async getUserSuggestions(
        userId: string,
        organizationId?: string,
        status?: SuggestionStatus,
    ) {
        return this.suggestionRepo.findByUser(userId, organizationId, {
            status,
        });
    }

    async getInsightSuggestions(insightId: string, organizationId?: string) {
        const insight = await this.insightRepo.findById(insightId);
        if (!insight) {
            throw new NotFoundException(
                `Insight with ID ${insightId} not found`,
            );
        }
        if (
            organizationId &&
            insight.organizationId &&
            insight.organizationId !== organizationId
        ) {
            throw new NotFoundException(
                `Insight with ID ${insightId} not found`,
            );
        }
        return this.suggestionRepo.findByInsightId(insightId);
    }

    async getOrGenerateForInsight(
        insightId: string,
        userId: string,
        organizationId?: string,
    ) {
        const insight = await this.insightRepo.findById(insightId);
        if (!insight) {
            throw new NotFoundException(
                `Insight with ID ${insightId} not found`,
            );
        }

        const orgId = organizationId ?? insight.organizationId ?? 'org-1';

        const existing = await this.suggestionRepo.findByInsightId(insightId);
        if (existing.length > 0) {
            return existing;
        }

        return this.generateForInsight(insightId, userId, orgId);
    }

    async updateStatus(id: string, status: SuggestionStatus) {
        const existing = await this.suggestionRepo.findById(id);
        if (!existing) {
            throw new NotFoundException(`Suggestion with ID ${id} not found`);
        }

        if (
            (status === SuggestionStatus.ACCEPTED ||
                status === SuggestionStatus.COMPLETED) &&
            existing.insightId
        ) {
            const peerSuggestions = await this.suggestionRepo.findByInsightId(
                existing.insightId,
            );
            for (const peer of peerSuggestions) {
                if (
                    peer.id !== id &&
                    peer.status !== SuggestionStatus.PENDING
                ) {
                    await this.suggestionRepo.updateStatus(
                        peer.id,
                        SuggestionStatus.PENDING,
                    );
                }
            }
        }

        return this.suggestionRepo.updateStatus(id, status);
    }

    async generateForInsight(
        insightId: string,
        _userId: string,
        organizationId?: string,
    ) {
        const insight = await this.insightRepo.findById(insightId);
        if (!insight) {
            throw new NotFoundException(
                `Insight with ID ${insightId} not found`,
            );
        }

        const orgId = organizationId ?? insight.organizationId ?? 'org-1';

        this.logger.log(
            `Generating on-demand suggestions for insight ${insightId} (orgId: ${orgId})`,
        );

        // Clear existing suggestions for this insight so new ones replace old ones
        await this.suggestionRepo.deleteByInsightId(insightId);

        const syntheticChunk = {
            id: `chunk-on-demand-${insightId}`,
            envelopes: [
                {
                    envelope: {
                        id: `env-on-demand-${insightId}`,
                        sourcePlugin: insight.sourcePlugin ?? 'system',
                        sourceId: `src-${insightId}`,
                        type: 'message' as const,
                        hasAttachment: false,
                        authorId: null,
                        organizationId: orgId,
                        occurredAt: new Date(),
                    },
                    payload: {
                        id: `payload-${insightId}`,
                        type: 'direct' as const,
                        content: insight.content,
                        groupId: insight.groupId ?? null,
                        channelId: insight.channelId ?? null,
                        replyTo: null,
                        topicId: insight.topicId ?? null,
                        reactions: {},
                        pinned: false,
                        editedDate: null,
                        entities: null,
                        rawPayload: {},
                    },
                },
            ],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 1,
            },
        };

        await this.capabilityManager.executeByName('suggestions-extractor', {
            chunk: syntheticChunk,
            previousIntelligence: [insight],
        });

        return this.suggestionRepo.findByInsightId(insightId);
    }
}
