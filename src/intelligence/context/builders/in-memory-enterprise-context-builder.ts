import { Injectable, Logger } from '@nestjs/common';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';
import { AppDbService } from '../../../prisma/app-db/app-db.service';
import { Insight } from '../../../types/insight.types';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import {
    EnterpriseContext,
    RetrievalWindow,
    PreviousIntelligenceQuery,
} from '../types/enterprise-context.types';
import { EnterpriseContextBuilder } from './enterprise-context-builder.abstract';
import { WindowDiscoveryService } from '../services/window-discovery.service';
import { toInsight, toEnvelopeWithPayload } from '../utils/context-mappers';

@Injectable()
export class InMemoryEnterpriseContextBuilder extends EnterpriseContextBuilder {
    private readonly logger = new Logger(InMemoryEnterpriseContextBuilder.name);
    private static readonly DEFAULT_INSIGHT_LIMIT = 20;

    constructor(
        private readonly rawDb: RawDbService,
        private readonly appDb: AppDbService,
        private readonly windowDiscovery: WindowDiscoveryService,
    ) {
        super();
    }

    async *build(
        organizationId: string,
        options?: {
            minMessages?: number;
            envelopeIds?: string[];
            windowStart?: Date;
            windowEnd?: Date;
        },
    ): AsyncIterable<EnterpriseContext> {
        if (options?.envelopeIds?.length) {
            yield await this.buildSingleContext(organizationId, {
                ids: options.envelopeIds,
            });
            return;
        }

        if (options?.windowStart || options?.windowEnd) {
            yield await this.buildSingleContext(organizationId, {
                windowStart: options.windowStart,
                windowEnd: options.windowEnd,
            });
            return;
        }

        const windows = await this.windowDiscovery.discoverWindows(
            organizationId,
            { minMessages: options?.minMessages },
        );

        if (windows.length === 0) {
            this.logger.log(`No windows discovered for org=${organizationId}`);
            return;
        }

        this.logger.log(
            `Discovered ${windows.length} windows for org=${organizationId}`,
        );

        for (const window of windows) {
            yield await this.buildWindowContext(organizationId, window);
        }
    }

    private async buildWindowContext(
        organizationId: string,
        window: RetrievalWindow,
    ): Promise<EnterpriseContext> {
        const envelopes = await this.loadEnvelopes(organizationId, {
            windowStart: window.start,
            windowEnd: window.end,
        });

        this.logger.debug(
            `Window ${window.start.toISOString()}–${window.end.toISOString()}: ${envelopes.length} envelopes`,
        );

        return this.createContext(organizationId, window, envelopes);
    }

    private async buildSingleContext(
        organizationId: string,
        spec: { ids?: string[]; windowStart?: Date; windowEnd?: Date },
    ): Promise<EnterpriseContext> {
        const envelopes = await this.loadEnvelopes(organizationId, spec);

        let window: RetrievalWindow;
        if (spec.ids) {
            window = {
                start: new Date(0),
                end: new Date(),
                messageCount: spec.ids.length,
            };
        } else {
            window = {
                start: spec.windowStart ?? new Date(0),
                end: spec.windowEnd ?? new Date(),
                messageCount: envelopes.length,
            };
        }

        return this.createContext(organizationId, window, envelopes);
    }

    private createContext(
        organizationId: string,
        window: RetrievalWindow,
        envelopes: EnvelopeWithPayload[],
    ): EnterpriseContext {
        return {
            organizationId,
            window,
            metadata: {},
            envelopes,
            previousIntelligence: (query) =>
                this.queryPreviousIntelligence(organizationId, query),
        };
    }

    private async queryPreviousIntelligence(
        organizationId: string,
        query: PreviousIntelligenceQuery,
    ): Promise<Insight[]> {
        const limit =
            query.limit ??
            InMemoryEnterpriseContextBuilder.DEFAULT_INSIGHT_LIMIT;
        if (limit <= 0) return [];

        const scope = query.scope;
        if (!scope || !scope.sourcePlugin) {
            return this.loadLatestInsights(organizationId, limit);
        }

        return this.loadScopedInsights(organizationId, scope, limit);
    }

    private async loadLatestInsights(
        organizationId: string,
        limit: number,
    ): Promise<Insight[]> {
        const versions = await this.appDb.insightVersion.findMany({
            where: { insight: { organizationId } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { insight: { select: { organizationId: true } } },
        });

        return versions.map(toInsight);
    }

    private async loadScopedInsights(
        organizationId: string,
        scope: NonNullable<PreviousIntelligenceQuery['scope']>,
        limit: number,
    ): Promise<Insight[]> {
        const versionWhere: Record<string, unknown> = {};

        if (scope.sourcePlugin) versionWhere.sourcePlugin = scope.sourcePlugin;

        if (scope.channelId || scope.topicId) {
            if (scope.channelId) versionWhere.channelId = scope.channelId;
            if (scope.topicId) versionWhere.topicId = scope.topicId;
        } else if (scope.groupId) {
            versionWhere.groupId = scope.groupId;
            versionWhere.channelId = null;
            versionWhere.topicId = null;
        }

        const versions = await this.appDb.insightVersion.findMany({
            where: { ...versionWhere, insight: { organizationId } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { insight: { select: { organizationId: true } } },
        });

        return versions.map(toInsight);
    }

    private async loadEnvelopes(
        organizationId: string,
        spec: { ids?: string[]; windowStart?: Date; windowEnd?: Date },
    ): Promise<EnvelopeWithPayload[]> {
        const where: Record<string, unknown> = { organizationId };

        if (spec.ids) {
            where.id = { in: spec.ids };
        } else {
            where.occurredAt = {};
            if (spec.windowStart)
                (where.occurredAt as any).gte = spec.windowStart;
            if (spec.windowEnd) (where.occurredAt as any).lte = spec.windowEnd;
        }

        const rows = await this.rawDb.envelope.findMany({
            where,
            include: {
                payload: {
                    select: {
                        id: true,
                        type: true,
                        content: true,
                        groupId: true,
                        channelId: true,
                        topicId: true,
                        replyTo: true,
                        reactions: true,
                        pinned: true,
                        editedDate: true,
                        entities: true,
                    },
                },
            },
            orderBy: [
                { sourcePlugin: 'asc' },
                { payload: { channelId: 'asc' } },
                { occurredAt: 'asc' },
            ],
        });

        return rows.map(toEnvelopeWithPayload);
    }
}
