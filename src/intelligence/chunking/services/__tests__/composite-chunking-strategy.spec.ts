import { CompositeChunkingStrategy } from '../composite-chunking-strategy';
import { SourcePartitioner } from '../../partitioners/source-partitioner';
import { GroupIdPartitioner } from '../../partitioners/group-id-partitioner';
import { ChannelIdPartitioner } from '../../partitioners/channel-id-partitioner';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { DataChunk } from '../../types/data-chunk.type';

function makeEnvelope(overrides?: {
    sourcePlugin?: string;
    groupId?: string | null;
    channelId?: string | null;
    occurredAt?: Date;
}): EnvelopeWithPayload {
    return {
        envelope: {
            id: `${Date.now()}_${Math.random()}`,
            sourcePlugin: overrides?.sourcePlugin ?? 'telegram',
            sourceId: `${Date.now()}_${Math.random()}`,
            type: 'message',
            hasAttachment: false,
            authorId: 'user_1',
            occurredAt: overrides?.occurredAt ?? new Date(),
        },
        payload: {
            id: `${Date.now()}_${Math.random()}`,
            type: 'direct',
            content: 'test message',
            groupId: overrides?.groupId ?? null,
            channelId: overrides?.channelId ?? null,
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

describe('CompositeChunkingStrategy', () => {
    let strategy: CompositeChunkingStrategy;

    beforeEach(() => {
        strategy = new CompositeChunkingStrategy({
            partitioners: [
                new SourcePartitioner(),
                new GroupIdPartitioner(),
                new ChannelIdPartitioner(),
            ],
        });
    });

    describe('partitioning', () => {
        it('groups by sourcePlugin correctly', async () => {
            const batch = [
                makeEnvelope({ sourcePlugin: 'telegram' }),
                makeEnvelope({ sourcePlugin: 'telegram' }),
                makeEnvelope({ sourcePlugin: 'discord' }),
                makeEnvelope({ sourcePlugin: 'discord' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(2);
        });

        it('groups by groupId within the same source', async () => {
            const batch = [
                makeEnvelope({ groupId: 'chat_a' }),
                makeEnvelope({ groupId: 'chat_a' }),
                makeEnvelope({ groupId: 'chat_b' }),
                makeEnvelope({ groupId: 'chat_b' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            for (const c of chunks) {
                const groupId = c.envelopes[0].payload.groupId;
                expect(
                    c.envelopes.every((e) => e.payload.groupId === groupId),
                ).toBe(true);
            }
        });

        it('groups by channelId within the same source and group', async () => {
            const batch = [
                makeEnvelope({ groupId: 'chat_a', channelId: 'chan_1' }),
                makeEnvelope({ groupId: 'chat_a', channelId: 'chan_1' }),
                makeEnvelope({ groupId: 'chat_a', channelId: 'chan_2' }),
                makeEnvelope({ groupId: 'chat_a', channelId: 'chan_2' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            for (const c of chunks) {
                const channelId = c.envelopes[0].payload.channelId;
                expect(
                    c.envelopes.every((e) => e.payload.channelId === channelId),
                ).toBe(true);
            }
        });
    });

    describe('fingerprint', () => {
        it('builds correct deep fingerprint path', async () => {
            const batch = [
                makeEnvelope({
                    sourcePlugin: 'telegram',
                    groupId: 'chat_99',
                    channelId: 'chan_1',
                }),
                makeEnvelope({
                    sourcePlugin: 'telegram',
                    groupId: 'chat_99',
                    channelId: 'chan_1',
                }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).toMatch(
                /^source:telegram\/group-id:chat_99\/channel-id:chan_1\/minimal$/,
            );
        });

        it('includes all partitioner keys in fingerprint', async () => {
            const batch = [
                makeEnvelope({ sourcePlugin: 'telegram', groupId: 'chat_a' }),
                makeEnvelope({ sourcePlugin: 'telegram', groupId: 'chat_a' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).toMatch(
                /^source:telegram\/group-id:chat_a\/channel-id:__null__\/minimal$/,
            );
        });
    });

    describe('basic behavior', () => {
        it('preserves all envelopes', async () => {
            const batch = [
                makeEnvelope({ sourcePlugin: 'telegram', groupId: 'chat_a' }),
                makeEnvelope({ sourcePlugin: 'telegram', groupId: 'chat_b' }),
                makeEnvelope({ sourcePlugin: 'telegram', groupId: 'chat_c' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            const totalEnvs = chunks.reduce(
                (sum, c) => sum + c.envelopes.length,
                0,
            );
            expect(totalEnvs).toBe(3);
        });
    });

    describe('edge cases', () => {
        it('handles empty batch', async () => {
            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run([])) {
                chunks.push(chunk);
            }
            expect(chunks).toHaveLength(0);
        });

        it('handles single envelope', async () => {
            const batch = [makeEnvelope()];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].envelopes).toHaveLength(1);
        });

        it('groups null groupId under __null__ key', async () => {
            const batch = [
                makeEnvelope({ groupId: null }),
                makeEnvelope({ groupId: 'chat_a' }),
                makeEnvelope({ groupId: null }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            const nullChunk = chunks.find((c) => c.id.includes('__null__'))!;
            expect(nullChunk).toBeDefined();
            expect(nullChunk.envelopes).toHaveLength(2);
        });

        it('handles envelopes with same timestamp', async () => {
            const now = new Date();
            const batch = [
                makeEnvelope({
                    sourcePlugin: 'telegram',
                    groupId: 'chat_a',
                    occurredAt: now,
                }),
                makeEnvelope({
                    sourcePlugin: 'telegram',
                    groupId: 'chat_a',
                    occurredAt: now,
                }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].envelopes).toHaveLength(2);
        });
    });
});
