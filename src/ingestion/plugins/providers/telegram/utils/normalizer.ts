import { EnvelopeWithPayload } from 'src/types/envelope.types';
import type { TelegramMessageRaw } from '../types/telegram.types';

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
            entities: msg.resolved_entities as unknown as Record<
                string,
                unknown
            > | null,
            rawPayload: msg.raw,
        },
    };
}
