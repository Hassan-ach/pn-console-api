import { TelegramMessageRaw } from '../types/telegram.types';

export interface ResolvedEntity {
    type: string;
    value: string | number | null;
    raw: Record<string, unknown>;
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
export function resolveEntities(
    text: string,
    rawEntities: any[],
): ResolvedEntity[] {
    return rawEntities.map((rawEntity) => {
        const type = Object.keys(rawEntity)[0];
        const data = rawEntity[type];
        let value: string | number | null = null;

        if (type === 'MentionName') {
            value = data.user_id;
        } else if (
            data &&
            typeof data.offset === 'number' &&
            typeof data.length === 'number'
        ) {
            value = text.substring(data.offset, data.offset + data.length);
        }

        return { type, value, raw: rawEntity };
    });
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export function resolveTopicId(
    msg: any,
    raw: any,
    messageToTopicMap: Map<number, number>,
): number {
    const currentMsgId = msg.id as number;

    if (
        raw.className === 'MessageService' &&
        raw.action?.className === 'MessageActionTopicCreate'
    ) {
        return currentMsgId;
    }

    if (msg.replyTo) {
        if (msg.replyTo.forumTopic === true) {
            const replyToTopId = msg.replyTo.replyToTopId as number | undefined;
            if (replyToTopId != null) {
                return replyToTopId;
            }
            const replyToMsgId = msg.replyTo.replyToMsgId as number | undefined;
            if (replyToMsgId != null) {
                return Number(replyToMsgId);
            }
        } else {
            const replyToMsgId = msg.replyTo.replyToMsgId as number | undefined;
            if (replyToMsgId != null) {
                return messageToTopicMap.get(replyToMsgId) ?? 1;
            }
        }
    }

    return 1;
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
export function normalizeRawMessage(
    msg: any,
    raw: any,
    chatId: string,
    topicId: number | null,
): TelegramMessageRaw {
    const ts =
        msg.date instanceof Date
            ? msg.date
            : new Date((msg.date as number) * 1000);

    let channelId: string | null = null;
    let groupId: string | null = null;
    if (raw.peerId?.className === 'PeerChannel') {
        channelId = raw.peerId.channelId.toString();
    }
    if (raw.peerId?.className === 'PeerChat') {
        groupId = raw.peerId.chatId.toString();
    } else {
        groupId = chatId;
    }

    let authorId: string | null = null;
    if (raw.fromId?.userId) {
        authorId = raw.fromId.userId.toString();
    } else if (raw.fromId?.channelId) {
        authorId = raw.fromId.channelId.toString();
    } else if (raw.fromId?.chatId) {
        authorId = raw.fromId.chatId.toString();
    }

    const msgText = (msg.text ?? msg.message ?? '') as string;
    const resolvedEntities = resolveEntities(msgText, raw.entities ?? []);

    return {
        id: msg.id as number,
        channel_id: channelId,
        group_id: groupId,
        text: msgText,
        date: ts,
        replyTo: (msg.replyTo?.replyToMsgId as number | undefined) ?? null,
        topic_id: topicId,
        author_id: authorId,
        hasAttachment: !!msg.media,
        reactions: raw.reactions ?? {},
        pinned: !!msg.pinned,
        editedDate: msg.editDate ?? null,
        resolved_entities:
            resolvedEntities.length > 0 ? resolvedEntities : null,
        raw,
    };
}
