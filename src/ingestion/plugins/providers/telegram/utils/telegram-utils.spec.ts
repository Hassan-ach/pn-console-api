import { resolveEntities, resolveTopicId, normalizeRawMessage } from './telegram-utils';

describe('resolveEntities', () => {
    it('returns [] for empty entities', () => {
        expect(resolveEntities('hello', [])).toEqual([]);
    });

    it('extracts user_id from MentionName entity', () => {
        const entities = [{ MentionName: { user_id: 12345 } }];
        const result = resolveEntities('', entities);
        expect(result).toEqual([
            { type: 'MentionName', value: 12345, raw: entities[0] },
        ]);
    });

    it('extracts text substring for entity with offset/length', () => {
        const entities = [{ Bold: { offset: 0, length: 5 } }];
        const result = resolveEntities('Hello world', entities);
        expect(result).toEqual([
            { type: 'Bold', value: 'Hello', raw: entities[0] },
        ]);
    });

    it('returns null value for unknown type without offset/length', () => {
        const entities = [{ CustomEmoji: { document_id: 123 } }];
        const result = resolveEntities('Hi', entities);
        expect(result).toEqual([
            { type: 'CustomEmoji', value: null, raw: entities[0] },
        ]);
    });
});

describe('resolveTopicId', () => {
    const emptyMap = new Map<number, number>();

    it('returns msg.id for MessageService with MessageActionTopicCreate', () => {
        const msg = { id: 42 };
        const raw = {
            className: 'MessageService',
            action: { className: 'MessageActionTopicCreate' },
        };
        expect(resolveTopicId(msg, raw, emptyMap)).toBe(42);
    });

    it('returns replyToTopId when replyTo.forumTopic is true', () => {
        const msg = {
            id: 1,
            replyTo: { forumTopic: true, replyToTopId: 99, replyToMsgId: 50 },
        };
        expect(resolveTopicId(msg, {}, emptyMap)).toBe(99);
    });

    it('falls back to replyToMsgId when replyToTopId is absent', () => {
        const msg = {
            id: 1,
            replyTo: { forumTopic: true, replyToMsgId: 50 },
        };
        expect(resolveTopicId(msg, {}, emptyMap)).toBe(50);
    });

    it('looks up in map when replyTo exists but forumTopic is false', () => {
        const map = new Map<number, number>([[50, 7]]);
        const msg = {
            id: 1,
            replyTo: { forumTopic: false, replyToMsgId: 50 },
        };
        expect(resolveTopicId(msg, {}, map)).toBe(7);
    });

    it('defaults to 1 when replyTo exists but forumTopic is false and map misses', () => {
        const msg = {
            id: 1,
            replyTo: { forumTopic: false, replyToMsgId: 50 },
        };
        expect(resolveTopicId(msg, {}, emptyMap)).toBe(1);
    });

    it('returns 1 when no replyTo exists', () => {
        const msg = { id: 1 };
        expect(resolveTopicId(msg, {}, emptyMap)).toBe(1);
    });
});

describe('normalizeRawMessage', () => {
    it('converts a basic text message to TelegramMessageRaw', () => {
        const msg = {
            id: 100,
            date: new Date('2025-01-01T12:00:00Z'),
            text: 'hello world',
            media: false,
            pinned: false,
            editDate: null,
            replyTo: { replyToMsgId: 5 },
        };
        const raw = {
            peerId: { className: 'PeerChannel', channelId: 777 },
            fromId: { userId: 42 },
            reactions: { likes: 1 },
            entities: [{ Bold: { offset: 0, length: 5 } }],
        };

        const result = normalizeRawMessage(msg, raw, 'chat-1', 3);

        expect(result.id).toBe(100);
        expect(result.channel_id).toBe('777');
        expect(result.group_id).toBe('chat-1');
        expect(result.author_id).toBe('42');
        expect(result.text).toBe('hello world');
        expect(result.replyTo).toBe(5);
        expect(result.topic_id).toBe(3);
        expect(result.hasAttachment).toBe(false);
        expect(result.pinned).toBe(false);
        expect(result.editedDate).toBeNull();
        expect(result.resolved_entities).toHaveLength(1);
        expect(result.resolved_entities![0].type).toBe('Bold');
    });

    it('handles PeerChat group and fromId.channelId', () => {
        const msg = {
            id: 1,
            date: 1704067200,
            message: 'group msg',
            media: { photo: true },
            pinned: true,
            editDate: new Date(),
            replyTo: null,
        };
        const raw = {
            peerId: { className: 'PeerChat', chatId: 888 },
            fromId: { channelId: 999 },
            reactions: {},
            entities: [],
        };

        const result = normalizeRawMessage(msg, raw, 'chat-g', null);

        expect(result.channel_id).toBeNull();
        expect(result.group_id).toBe('888');
        expect(result.author_id).toBe('999');
        expect(result.text).toBe('group msg');
        expect(result.hasAttachment).toBe(true);
        expect(result.pinned).toBe(true);
        expect(result.resolved_entities).toBeNull();
    });
});
