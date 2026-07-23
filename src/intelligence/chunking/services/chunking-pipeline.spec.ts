import { ChunkingPipeline } from './chunking-pipeline.service';
import type { ChunkingStrategy } from '../interfaces/chunking-strategy.interface';
import type { DataChunk } from '../types/data-chunk.type';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';

const dummyEnvelope: EnvelopeWithPayload = {
    envelope: {
        id: 'e1',
        sourcePlugin: 'test',
        sourceId: 's1',
        type: 'message',
        hasAttachment: false,
        authorId: 'u1',
        occurredAt: new Date(),
    },
    payload: {
        id: 'p1',
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

function makeChunk(id: string, envelopes: EnvelopeWithPayload[]): DataChunk {
    return {
        id,
        envelopes,
        metadata: {
            timeRange: { start: new Date(), end: new Date() },
            envelopeCount: envelopes.length,
        },
    };
}

function mockStrategy(name: string, ...chunks: DataChunk[]): ChunkingStrategy {
    return {
        name,
        async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
            if (batch.length === 0) return;
            for (const c of chunks) {
                yield c;
            }
        },
    };
}

describe('ChunkingPipeline', () => {
    it('yields chunks from a single strategy', async () => {
        const chunkA = makeChunk('a', [dummyEnvelope]);
        const strategy = mockStrategy('s1', chunkA);
        const pipeline = new ChunkingPipeline([strategy]);

        const result: DataChunk[] = [];
        for await (const c of pipeline.run([dummyEnvelope])) {
            result.push(c);
        }

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
    });

    it('yields chunks from multiple strategies in order', async () => {
        const chunkA = makeChunk('a', [dummyEnvelope]);
        const chunkB = makeChunk('b', [dummyEnvelope]);
        const s1 = mockStrategy('s1', chunkA);
        const s2 = mockStrategy('s2', chunkB);
        const pipeline = new ChunkingPipeline([s1, s2]);

        const result: DataChunk[] = [];
        for await (const c of pipeline.run([dummyEnvelope])) {
            result.push(c);
        }

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('a');
        expect(result[1].id).toBe('b');
    });

    it('yields nothing when strategies yield nothing', async () => {
        const strategy = mockStrategy('empty');
        const pipeline = new ChunkingPipeline([strategy]);

        const result: DataChunk[] = [];
        for await (const c of pipeline.run([dummyEnvelope])) {
            result.push(c);
        }

        expect(result).toHaveLength(0);
    });

    it('yields nothing for empty batch', async () => {
        const chunkA = makeChunk('a', [dummyEnvelope]);
        const strategy = mockStrategy('s1', chunkA);
        const pipeline = new ChunkingPipeline([strategy]);

        const result: DataChunk[] = [];
        for await (const c of pipeline.run([])) {
            result.push(c);
        }

        expect(result).toHaveLength(0);
    });
});
