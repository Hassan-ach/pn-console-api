import { Injectable } from '@nestjs/common';
import { RawDbService } from '../../prisma/raw-db/raw-db.service';
import { AppDbService } from '../../prisma/app-db/app-db.service';
import { Insight } from '../../types/insight.types';
import { EnvelopeWithPayload } from '../../types/envelope.types';
import { EnterpriseContext } from './enterprise-context.types';
import { EnterpriseContextBuilder } from './enterprise-context-builder.abstract';

@Injectable()
export class InMemoryEnterpriseContextBuilder extends EnterpriseContextBuilder {
    constructor(
        private readonly rawDb: RawDbService,
        private readonly appDb: AppDbService,
    ) {
        super();
    }

    build(organizationId: string): EnterpriseContext {
        return {
            organizationId,
            metadata: {},
            previousIntelligence: (opts) =>
                this.loadPreviousIntelligence(organizationId, opts),
            envelopes: (opts) => this.queryEnvelopes(organizationId, opts),
        };
    }

    private async *loadPreviousIntelligence(
        organizationId: string,
        opts?: { maxItems?: number; windowStart?: Date; windowEnd?: Date },
    ): AsyncIterable<Insight[]> {
        const where: Record<string, unknown> = { organizationId };

        if (opts?.windowStart || opts?.windowEnd) {
            where.updatedAt = {};
            if (opts.windowStart)
                (where.updatedAt as any).gte = opts.windowStart;
            if (opts.windowEnd) (where.updatedAt as any).lte = opts.windowEnd;
        }

        const insights = await this.appDb.insight.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: opts?.maxItems,
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        yield insights.flatMap((i) =>
            i.versions.map(
                (v): Insight => ({
                    id: i.id,
                    type: v.type,
                    content: v.content,
                    owners: v.owners,
                    version: v.version,
                    createdAt: v.createdAt,
                }),
            ),
        );
    }

    private async *queryEnvelopes(
        organizationId: string,
        opts?: { windowStart?: Date; windowEnd?: Date; maxBatchSize?: number },
    ): AsyncIterable<EnvelopeWithPayload[]> {
        const where: Record<string, unknown> = { organizationId };

        if (opts?.windowStart || opts?.windowEnd) {
            where.occurredAt = {};
            if (opts.windowStart)
                (where.occurredAt as any).gte = opts.windowStart;
            if (opts.windowEnd) (where.occurredAt as any).lte = opts.windowEnd;
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
            take: opts?.maxBatchSize,
        });

        yield rows.map(
            (env): EnvelopeWithPayload => ({
                envelope: {
                    id: env.id,
                    sourcePlugin: env.sourcePlugin,
                    sourceId: env.sourceId,
                    type: env.type.toLowerCase() as 'message',
                    hasAttachment: env.hasAttachment,
                    authorId: env.authorId,
                    occurredAt: env.occurredAt,
                },
                payload: {
                    id: env.payload.id,
                    type: env.payload.type.toLowerCase() as 'direct' | 'email',
                    content: env.payload.content,
                    groupId: env.payload.groupId,
                    channelId: env.payload.channelId,
                    replyTo: env.payload.replyTo,
                    reactions: env.payload.reactions as Record<string, unknown>,
                    pinned: env.payload.pinned,
                    editedDate: env.payload.editedDate,
                    entities: env.payload.entities as Record<
                        string,
                        unknown
                    > | null,
                    rawPayload: {} as Record<string, unknown>,
                },
            }),
        );
    }
}
