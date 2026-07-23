import { toInsight, toEnvelopeWithPayload } from './context-mappers';

describe('toInsight', () => {
    it('maps a full record correctly', () => {
        const createdAt = new Date('2026-07-01');
        const input = {
            insightId: 'i1',
            insight: { organizationId: 'org-1' },
            type: 'TASK',
            content: 'do something',
            owners: [{ userId: 'u1' }, { userId: 'u2' }],
            envolopsRef: ['e1', 'e2'],
            broadcasted: true,
            version: 2,
            createdAt,
            sourcePlugin: 'telegram',
            groupId: 'g1',
            channelId: 'c1',
            topicId: 't1',
        };

        const result = toInsight(input);

        expect(result).toEqual({
            id: 'i1',
            organizationId: 'org-1',
            type: 'TASK',
            content: 'do something',
            owners: ['u1', 'u2'],
            envolopsRef: ['e1', 'e2'],
            broadcasted: true,
            version: 2,
            createdAt,
            sourcePlugin: 'telegram',
            groupId: 'g1',
            channelId: 'c1',
            topicId: 't1',
        });
    });

    it('handles minimal record with no owners', () => {
        const createdAt = new Date('2026-07-01');
        const input = {
            insightId: 'i1',
            type: 'INFO',
            content: 'info',
            owners: [],
            broadcasted: false,
            version: 1,
            createdAt,
        };

        const result = toInsight(input);

        expect(result.owners).toEqual([]);
        expect(result.organizationId).toBeUndefined();
    });

    it('handles missing owners field', () => {
        const createdAt = new Date('2026-07-01');
        const input = {
            insightId: 'i1',
            type: 'INFO',
            content: 'info',
            broadcasted: false,
            createdAt,
        };

        const result = toInsight(input);

        expect(result.owners).toEqual([]);
    });

    it('handles null broadcasted', () => {
        const createdAt = new Date('2026-07-01');
        const input = {
            insightId: 'i1',
            type: 'DECISION',
            content: 'decision',
            broadcasted: null,
            createdAt,
        };

        const result = toInsight(input);

        expect(result.broadcasted).toBeNull();
    });

    it('handles undefined sourcePlugin', () => {
        const createdAt = new Date('2026-07-01');
        const input = {
            insightId: 'i1',
            type: 'URGENCY',
            content: 'urgent',
            broadcasted: false,
            createdAt,
            sourcePlugin: undefined,
        };

        const result = toInsight(input);

        expect(result.sourcePlugin).toBeUndefined();
    });
});

describe('toEnvelopeWithPayload', () => {
    it('maps a full envelope correctly', () => {
        const occurredAt = new Date('2026-07-01T12:00:00Z');
        const input = {
            id: 'env1',
            sourcePlugin: 'telegram',
            sourceId: 'src1',
            type: 'MESSAGE',
            hasAttachment: false,
            authorId: 'u1',
            occurredAt,
            payload: {
                id: 'p1',
                type: 'DIRECT',
                content: 'hello',
                groupId: 'g1',
                channelId: 'c1',
                topicId: 't1',
                replyTo: null,
                reactions: { thumbsUp: 1 },
                pinned: false,
                editedDate: null,
                entities: null,
            },
        };

        const result = toEnvelopeWithPayload(input);

        expect(result.envelope).toEqual({
            id: 'env1',
            sourcePlugin: 'telegram',
            sourceId: 'src1',
            type: 'message',
            hasAttachment: false,
            authorId: 'u1',
            occurredAt,
        });
        expect(result.payload).toEqual({
            id: 'p1',
            type: 'direct',
            content: 'hello',
            groupId: 'g1',
            channelId: 'c1',
            topicId: 't1',
            replyTo: null,
            reactions: { thumbsUp: 1 },
            pinned: false,
            editedDate: null,
            entities: null,
            rawPayload: {},
        });
    });

    it('lowercases type and payload type', () => {
        const input = {
            id: 'env1',
            sourcePlugin: 'x',
            sourceId: 'x',
            type: 'MESSAGE',
            hasAttachment: false,
            authorId: null,
            occurredAt: new Date(),
            payload: {
                id: 'p1',
                type: 'DIRECT',
                content: 'hi',
                groupId: null,
                channelId: null,
                topicId: null,
                replyTo: null,
                reactions: {},
                pinned: false,
                editedDate: null,
                entities: null,
            },
        };

        const result = toEnvelopeWithPayload(input);

        expect(result.envelope.type).toBe('message');
        expect(result.payload.type).toBe('direct');
    });

    it('handles null entities and groupId', () => {
        const input = {
            id: 'env1',
            sourcePlugin: 'x',
            sourceId: 'x',
            type: 'message',
            hasAttachment: false,
            authorId: null,
            occurredAt: new Date(),
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hi',
                groupId: null,
                channelId: null,
                topicId: null,
                replyTo: null,
                reactions: {},
                pinned: false,
                editedDate: null,
                entities: null,
            },
        };

        const result = toEnvelopeWithPayload(input);

        expect(result.payload.entities).toBeNull();
        expect(result.payload.groupId).toBeNull();
    });

    it('preserves reactions object', () => {
        const input = {
            id: 'env1',
            sourcePlugin: 'x',
            sourceId: 'x',
            type: 'message',
            hasAttachment: false,
            authorId: null,
            occurredAt: new Date(),
            payload: {
                id: 'p1',
                type: 'direct',
                content: 'hi',
                groupId: null,
                channelId: null,
                topicId: null,
                replyTo: null,
                reactions: { thumbsUp: 3, heart: 1 },
                pinned: false,
                editedDate: null,
                entities: null,
            },
        };

        const result = toEnvelopeWithPayload(input);

        expect(result.payload.reactions).toEqual({ thumbsUp: 3, heart: 1 });
    });
});
