/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Insight, InsightType } from '../../../types/insight.types';
import { EnvelopeWithPayload } from '../../../types/envelope.types';

export function toInsight(v: any): Insight {
    return {
        id: v.insightId,
        organizationId: v.insight?.organizationId ?? undefined,
        type: v.type as InsightType,
        content: v.content,
        owners: v.owners?.map((o: any) => o.userId) ?? [],
        envolopsRef: v.envolopsRef ? [...v.envolopsRef] : [],
        broadcasted: v.broadcasted,
        version: v.version,
        createdAt: v.createdAt,
        sourcePlugin: v.sourcePlugin ?? undefined,
        groupId: v.groupId ?? undefined,
        channelId: v.channelId ?? undefined,
        topicId: v.topicId ?? undefined,
    };
}

export function toEnvelopeWithPayload(env: any): EnvelopeWithPayload {
    return {
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
            topicId: env.payload.topicId,
            replyTo: env.payload.replyTo,
            reactions: env.payload.reactions as Record<string, unknown>,
            pinned: env.payload.pinned,
            editedDate: env.payload.editedDate,
            entities: env.payload.entities as Record<string, unknown> | null,
            rawPayload: {},
        },
    };
}
