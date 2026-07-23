import { DailyPartitioner } from './daily-partitioner';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';

function makeEnvelope(occurredAt?: Date): EnvelopeWithPayload {
    return {
        envelope: {
            id: `${Date.now()}_${Math.random()}`,
            sourcePlugin: 'telegram',
            sourceId: `${Date.now()}_${Math.random()}`,
            type: 'message',
            hasAttachment: false,
            authorId: 'user_1',
            occurredAt: occurredAt ?? new Date(),
        },
        payload: {
            id: `${Date.now()}_${Math.random()}`,
            type: 'direct',
            content: 'test',
            groupId: null,
            channelId: null,
            replyTo: null,
            topicId: null,
            reactions: {},
            pinned: false,
            editedDate: null,
            entities: null,
            rawPayload: {},
        },
    };
}

function sameDay(date: Date): Date {
    return new Date(date);
}

function nextDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d;
}

describe('DailyPartitioner', () => {
    const base = new Date('2026-06-01T12:00:00Z');
    const day2 = nextDay(base);
    const day3 = nextDay(day2);

    describe('below minChunkMessages', () => {
        it('returns single all bucket when group is below min threshold', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 10,
                maxChunkMessages: 20,
            });
            const batch = Array.from({ length: 5 }, () =>
                makeEnvelope(sameDay(base)),
            );
            const result = p.split(batch);

            expect(result).toHaveLength(1);
            expect(result[0].key).toBe('all');
            expect(result[0].envelopes).toHaveLength(5);
        });
    });

    describe('single day fits in one bucket', () => {
        it('groups envelopes from same day under the date key', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 5,
                maxChunkMessages: 20,
            });
            const batch = Array.from({ length: 10 }, () =>
                makeEnvelope(sameDay(base)),
            );
            const result = p.split(batch);

            expect(result).toHaveLength(1);
            expect(result[0].key).toBe('2026-06-01');
            expect(result[0].envelopes).toHaveLength(10);
        });
    });

    describe('merge adjacent small days', () => {
        it('merges two small days when combined size <= maxChunkMessages', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 10,
                maxChunkMessages: 15,
            });
            const batch = [
                ...Array.from({ length: 5 }, () => makeEnvelope(sameDay(base))),
                ...Array.from({ length: 5 }, () => makeEnvelope(sameDay(day2))),
            ];
            const result = p.split(batch);

            expect(result).toHaveLength(1);
            expect(result[0].key).toBe('2026-06-01+2026-06-02');
            expect(result[0].envelopes).toHaveLength(10);
        });
    });

    describe('skip merge when bucket already >= minChunkMessages', () => {
        it('does not merge if existing bucket is already at min threshold', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 10,
                maxChunkMessages: 30,
            });
            const batch = [
                ...Array.from({ length: 10 }, () =>
                    makeEnvelope(sameDay(base)),
                ),
                ...Array.from({ length: 5 }, () => makeEnvelope(sameDay(day2))),
            ];
            const result = p.split(batch);

            expect(result).toHaveLength(2);
            expect(result[0].key).toBe('2026-06-01');
            expect(result[0].envelopes).toHaveLength(10);
            expect(result[1].key).toBe('2026-06-02');
            expect(result[1].envelopes).toHaveLength(5);
        });
    });

    describe('skip merge when combining would exceed max', () => {
        it('does not merge if combined size would exceed maxChunkMessages', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 5,
                maxChunkMessages: 20,
            });
            const batch = [
                ...Array.from({ length: 12 }, () =>
                    makeEnvelope(sameDay(base)),
                ),
                ...Array.from({ length: 12 }, () =>
                    makeEnvelope(sameDay(day2)),
                ),
            ];
            const result = p.split(batch);

            expect(result).toHaveLength(2);
            expect(result[0].key).toBe('2026-06-01');
            expect(result[0].envelopes).toHaveLength(12);
            expect(result[1].key).toBe('2026-06-02');
            expect(result[1].envelopes).toHaveLength(12);
        });
    });

    describe('empty input', () => {
        it('returns single all bucket for empty batch (below min threshold)', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 5,
                maxChunkMessages: 20,
            });
            const result = p.split([]);

            expect(result).toHaveLength(1);
            expect(result[0].key).toBe('all');
            expect(result[0].envelopes).toHaveLength(0);
        });
    });

    describe('complex multi-day merge', () => {
        it('merges early small days but splits larger later day', () => {
            const p = new DailyPartitioner({
                minChunkMessages: 5,
                maxChunkMessages: 10,
            });
            const batch = [
                ...Array.from({ length: 4 }, () => makeEnvelope(sameDay(base))),
                ...Array.from({ length: 4 }, () => makeEnvelope(sameDay(day2))),
                ...Array.from({ length: 8 }, () => makeEnvelope(sameDay(day3))),
            ];
            const result = p.split(batch);

            expect(result).toHaveLength(2);
            expect(result[0].key).toBe('2026-06-01+2026-06-02');
            expect(result[0].envelopes).toHaveLength(8);
            expect(result[1].key).toBe('2026-06-03');
            expect(result[1].envelopes).toHaveLength(8);
        });
    });
});
