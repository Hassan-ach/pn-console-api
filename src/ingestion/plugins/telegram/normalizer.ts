import { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { TelegramMessageRaw } from './telegram.types';

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
            groupId: msg.channel_id,
            channelId: msg.channel_id,
            replyTo: msg.replyTo?.toString() ?? null,
            reactions: msg.reactions,
            pinned: msg.pinned,
            editedDate: msg.editedDate ? new Date(msg.editedDate) : null,
            entities: msg.resolved_entities as any,
            rawPayload: msg.raw,
        },
    };
}
