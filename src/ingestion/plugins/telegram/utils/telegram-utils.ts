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
