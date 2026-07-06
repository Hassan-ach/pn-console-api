import { EnvelopeWithPayload } from '../interfaces/plugin.types';
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
            author_ref: msg.author,
            occurred_at: msg.date.toISOString(),
        },
        payload: {
            type: 'direct',
            content: msg.text,
            group_id: msg.chatId,
            reply_to: msg.replyTo?.toString() ?? null,
            reactions: msg.reactions,
            pinned: msg.pinned,
            edited_date: msg.editedDate,
            entities: msg.entities,
            raw_payload: msg.raw,
        },
    };
}
