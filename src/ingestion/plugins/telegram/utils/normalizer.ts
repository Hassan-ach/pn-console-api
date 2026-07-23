import { EnvelopeWithPayload } from '../../../../types/envelope.types';
import type { ResolvedEntity } from './telegram-utils';

export interface TelegramMessageRaw {
    id: number;
    channel_id: string | null;
    group_id: string | null;
    text: string;
    date: Date;
    replyTo: number | null;
    topic_id: number | null;
    author_id: string | null;
    hasAttachment: boolean;
    reactions: Record<string, unknown>;
    pinned: boolean;
    editedDate: string | null;
    resolved_entities: ResolvedEntity[] | null;
    raw: Record<string, unknown>;
}

export function normalizeTelegramMessage(
    msg: TelegramMessageRaw,
): EnvelopeWithPayload {
    return {
        envelope: {
            sourcePlugin: 'telegram',
            sourceId: msg.id.toString(),
            type: 'message',
            hasAttachment: msg.hasAttachment,
            authorId: msg.author_id,
            occurredAt: msg.date,
        },
        payload: {
            type: 'direct',
            content: msg.text,
            groupId: msg.group_id,
            channelId: msg.channel_id,
            replyTo: msg.replyTo?.toString() ?? null,
            topicId: msg.topic_id?.toString() ?? null,
            reactions: msg.reactions,
            pinned: msg.pinned,
            editedDate: msg.editedDate ? new Date(msg.editedDate) : null,
            entities: msg.resolved_entities as any,
            rawPayload: msg.raw,
        },
    };
}
