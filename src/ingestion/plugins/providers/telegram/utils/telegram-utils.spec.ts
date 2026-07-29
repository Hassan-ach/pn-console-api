import { resolveEntities, resolveTopicId } from './telegram-utils';

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
