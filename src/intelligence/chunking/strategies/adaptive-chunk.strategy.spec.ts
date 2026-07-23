import { AdaptiveChunkStrategy } from './adaptive-chunk.strategy';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { DataChunk } from '../types/data-chunk.type';
import type { ChunkingStrategy } from '../interfaces/chunking-strategy.interface';

let counter = 0;
function makeEnvelope(occurredAt: Date, src = 'telegram'): EnvelopeWithPayload {
    const n = counter++;
    return {
        envelope: {
            id: `e_${n}`,
            sourcePlugin: src,
            sourceId: `s_${n}`,
            type: 'message',
            hasAttachment: false,
            authorId: 'user_1',
            occurredAt,
        },
        payload: {
            id: `p_${n}`,
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
    s: AdaptiveChunkStrategy,
    batch: EnvelopeWithPayload[],
): Promise<DataChunk[]> {
    const chunks: DataChunk[] = [];
    for await (const c of s.run(batch)) chunks.push(c);
    return chunks;
}

const T0 = new Date('2026-06-01T12:00:00Z');

describe('AdaptiveChunkStrategy', () => {
    describe('batch within maxMessages', () => {
        it('emits single chunk when batch fits', async () => {
            const s = new AdaptiveChunkStrategy({
                maxMessages: 10,
                strategies: [],
            });
            const batch = Array.from({ length: 3 }, (_, i) =>
                makeEnvelope(new Date(T0.getTime() + i * 1000)),
            );
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(1);
            expect(chunks[0].envelopes).toHaveLength(3);
        });
    });

    describe('force-split when strategies exhausted', () => {
        it('force-splits by maxMessages when no strategies left', async () => {
            const s = new AdaptiveChunkStrategy({
                maxMessages: 2,
                strategies: [],
            });
            const batch = Array.from({ length: 5 }, (_, i) =>
                makeEnvelope(new Date(T0.getTime() + i * 1000)),
            );
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(3); // 2+2+1
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(2);
            expect(chunks[2].envelopes).toHaveLength(1);
        });
    });

    describe('delegates to sub-strategies', () => {
        it('applies strategy then checks maxMessages on result', async () => {
            const mockStrategy: ChunkingStrategy = {
                name: 'mock',
                async *run(batch) {
                    // Split into two groups by source
                    const tg = batch.filter(
                        (e) => e.envelope.sourcePlugin === 'telegram',
                    );
                    const dc = batch.filter(
                        (e) => e.envelope.sourcePlugin === 'discord',
                    );
                    if (tg.length)
                        yield {
                            id: 'tg',
                            envelopes: tg,
                            metadata: {
                                timeRange: { start: T0, end: T0 },
                                envelopeCount: tg.length,
                            },
                        };
                    if (dc.length)
                        yield {
                            id: 'dc',
                            envelopes: dc,
                            metadata: {
                                timeRange: { start: T0, end: T0 },
                                envelopeCount: dc.length,
                            },
                        };
                },
            };

            // batch.length > maxMessages forces strategy use
            const s = new AdaptiveChunkStrategy({
                maxMessages: 1,
                strategies: [mockStrategy],
            });
            const batch = [
                makeEnvelope(T0, 'telegram'),
                makeEnvelope(T0, 'discord'),
            ];
            const chunks = await collect(s, batch);
            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(1);
            expect(chunks[1].envelopes).toHaveLength(1);
        });

        it('re-applies adaptive check after strategy yields', async () => {
            const mockStrategy: ChunkingStrategy = {
                name: 'mock',
                async *run(batch) {
                    // Pass-through
                    yield {
                        id: 'all',
                        envelopes: batch,
                        metadata: {
                            timeRange: { start: T0, end: T0 },
                            envelopeCount: batch.length,
                        },
                    };
                },
            };

            const s = new AdaptiveChunkStrategy({
                maxMessages: 2,
                strategies: [mockStrategy],
            });
            const batch = Array.from({ length: 6 }, (_, i) =>
                makeEnvelope(new Date(T0.getTime() + i * 1000)),
            );
            const chunks = await collect(s, batch);
            // strategy returns 6 as one chunk, adaptive sees 6 > 2, no more strategies → force-split
            expect(chunks).toHaveLength(3);
            expect(chunks[0].envelopes).toHaveLength(2);
        });
    });
});
