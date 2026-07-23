import { TimeGapChunkStrategy } from './time-gap-chunk.strategy';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { DataChunk } from '../types/data-chunk.type';

function makeEnvelope(occurredAt: Date): EnvelopeWithPayload {
    return {
        envelope: {
            id: `e_${occurredAt.getTime()}`,
            sourcePlugin: 'telegram',
            sourceId: `s_${occurredAt.getTime()}`,
            type: 'message',
            hasAttachment: false,
            authorId: 'user_1',
            occurredAt,
        },
        payload: {
            id: `p_${occurredAt.getTime()}`,
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

async function collect(
    s: TimeGapChunkStrategy,
    batch: EnvelopeWithPayload[],
): Promise<DataChunk[]> {
    const chunks: DataChunk[] = [];
    for await (const c of s.run(batch)) chunks.push(c);
    return chunks;
}

const T0 = new Date('2026-06-01T12:00:00Z');

describe('TimeGapChunkStrategy', () => {
    describe('empty input', () => {
        it('yields nothing for empty batch', async () => {
            const s = new TimeGapChunkStrategy();
            const chunks = await collect(s, []);
            expect(chunks).toHaveLength(0);
        });
    });

    describe('single chunk', () => {
        it('yields one chunk when gap is within threshold', async () => {
            const s = new TimeGapChunkStrategy({ gapMinutes: 60 });
            const batch = [
                makeEnvelope(new Date(T0.getTime())),
                makeEnvelope(new Date(T0.getTime() + 30 * 60 * 1000)),
            ];
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(1);
            expect(chunks[0].envelopes).toHaveLength(2);
        });
    });

    describe('gap split', () => {
        it('splits when gap exceeds threshold', async () => {
            const s = new TimeGapChunkStrategy({ gapMinutes: 10 });
            const batch = [
                makeEnvelope(new Date(T0.getTime())),
                makeEnvelope(new Date(T0.getTime() + 5 * 60 * 1000)),
                makeEnvelope(new Date(T0.getTime() + 30 * 60 * 1000)),
            ];
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(1);
        });
    });

    describe('maxWindow split', () => {
        it('splits when window exceeds maxWindowMinutes', async () => {
            const s = new TimeGapChunkStrategy({
                gapMinutes: 999,
                maxWindowMinutes: 60,
            });
            const batch = [
                makeEnvelope(new Date(T0.getTime())),
                makeEnvelope(new Date(T0.getTime() + 30 * 60 * 1000)),
                makeEnvelope(new Date(T0.getTime() + 90 * 60 * 1000)),
            ];
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(1);
        });
    });

    describe('default options', () => {
        it('uses default gap 30m when no options given', async () => {
            const s = new TimeGapChunkStrategy();
            const batch = [
                makeEnvelope(new Date(T0.getTime())),
                makeEnvelope(new Date(T0.getTime() + 5 * 60 * 1000)),
                makeEnvelope(new Date(T0.getTime() + 40 * 60 * 1000)),
            ];
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(1);
        });
    });

    describe('chunk metadata', () => {
        it('sets correct timeRange on chunk', async () => {
            const s = new TimeGapChunkStrategy({ gapMinutes: 60 });
            const t1 = new Date(T0.getTime());
            const t2 = new Date(T0.getTime() + 10 * 60 * 1000);
            const chunks = await collect(s, [
                makeEnvelope(t1),
                makeEnvelope(t2),
            ]);
            expect(chunks[0].metadata.timeRange.start.getTime()).toBe(
                t1.getTime(),
            );
            expect(chunks[0].metadata.timeRange.end.getTime()).toBe(
                t2.getTime(),
            );
            expect(chunks[0].metadata.envelopeCount).toBe(2);
        });
    });
});
