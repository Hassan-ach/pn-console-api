import { normalizeTelegramMessage } from './normalizer';
import type { TelegramMessageRaw } from './normalizer';

describe('normalizeTelegramMessage', () => {
    const fullMessage: TelegramMessageRaw = {
        id: 123,
        channel_id: 'ch-1',
        group_id: 'grp-1',
        text: 'Hello world',
        date: new Date('2025-01-15T10:00:00Z'),
        replyTo: 42,
        topic_id: 7,
        author_id: 'user-1',
        hasAttachment: false,
        reactions: { like: 3 },
        pinned: true,
        editedDate: '2025-01-15T11:00:00Z',
        resolved_entities: [],
        raw: { some: 'data' },
    };

    it('maps all envelope fields correctly', () => {
        const result = normalizeTelegramMessage(fullMessage);
        expect(result.envelope.sourcePlugin).toBe('telegram');
        expect(result.envelope.sourceId).toBe('123');
        expect(result.envelope.type).toBe('message');
        expect(result.envelope.hasAttachment).toBe(false);
        expect(result.envelope.authorId).toBe('user-1');
        expect(result.envelope.occurredAt).toBe(fullMessage.date);
    });

    it('maps all payload fields correctly', () => {
        const result = normalizeTelegramMessage(fullMessage);
        expect(result.payload.content).toBe('Hello world');
        expect(result.payload.replyTo).toBe('42');
        expect(result.payload.topicId).toBe('7');
        expect(result.payload.reactions).toEqual({ like: 3 });
        expect(result.payload.pinned).toBe(true);
        expect(result.payload.groupId).toBe('grp-1');
        expect(result.payload.channelId).toBe('ch-1');
        expect(result.payload.editedDate).toEqual(
            new Date('2025-01-15T11:00:00Z'),
        );
    });

    it('maps null replyTo and topic_id to null', () => {
        const msg: TelegramMessageRaw = {
            ...fullMessage,
            replyTo: null,
            topic_id: null,
        };
        const result = normalizeTelegramMessage(msg);
        expect(result.payload.replyTo).toBeNull();
        expect(result.payload.topicId).toBeNull();
    });

    it('sets editedDate to null when editedDate is null', () => {
        const msg: TelegramMessageRaw = {
            ...fullMessage,
            editedDate: null,
        };
        const result = normalizeTelegramMessage(msg);
        expect(result.payload.editedDate).toBeNull();
    });
});
