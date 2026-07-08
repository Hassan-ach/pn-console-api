import { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { TelegramMessageRaw } from './telegram.types';

export function normalizeTelegramMessage(
    msg: TelegramMessageRaw,
): EnvelopeWithPayload {
    return {
        envelope: {
            source_plugin: 'telegram',
            source_id: msg.id.toString(),
            type: 'message',
            has_attachment: msg.hasAttachment,
            author_id: msg.author_id,
            occurred_at: msg.date.toISOString(),
        },
        payload: {
            type: 'direct',
            content: msg.text,
            group_id: msg.channel_id,
            channel_id: msg.channel_id,
            reply_to: msg.replyTo?.toString() ?? null,
            reactions: msg.reactions,
            pinned: msg.pinned,
            edited_date: msg.editedDate,
            entities: msg.resolved_entities as any,
            raw_payload: msg.raw,
        },
    };
}
