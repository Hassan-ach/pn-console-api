import { CompositeChunkingStrategy } from './composite-chunking-strategy';
import { SourcePartitioner } from './partitioners/source-partitioner';
import { GroupIdPartitioner } from './partitioners/group-id-partitioner';
import { ChannelIdPartitioner } from './partitioners/channel-id-partitioner';
import { TimeGapChunkStrategy } from './strategies/time-gap-chunk.strategy';
import type { EnvelopeWithPayload } from '../../types/envelope.types';
import type { DataChunk } from './types/data-chunk.type';

function makeEnvelope(overrides?: {
    source_plugin?: string;
    group_id?: string | null;
    channel_id?: string | null;
    occurred_at?: string;
}): EnvelopeWithPayload {
    return {
        envelope: {
            source_plugin: overrides?.source_plugin ?? 'telegram',
            source_id: `${Date.now()}_${Math.random()}`,
            type: 'message',
            has_attachment: false,
            author_id: 'user_1',
            occurred_at: overrides?.occurred_at ?? new Date().toISOString(),
        },
        payload: {
            type: 'direct',
            content: 'test message',
            group_id: overrides?.group_id ?? null,
            channel_id: overrides?.channel_id ?? null,
            reply_to: null,
            reactions: {},
            pinned: false,
            edited_date: null,
            entities: null,
            raw_payload: {},
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
            chunker: new TimeGapChunkStrategy({
                gapMinutes: 30,
                maxWindowMinutes: 240,
            }),
            minMessages: 2,
        });
    });

    describe('partitioning', () => {
        it('groups by source_plugin correctly', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram' }),
                makeEnvelope({ source_plugin: 'telegram' }),
                makeEnvelope({ source_plugin: 'discord' }),
                makeEnvelope({ source_plugin: 'discord' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            expect(chunks[0].envelopes).toHaveLength(2);
            expect(chunks[1].envelopes).toHaveLength(2);
        });

        it('groups by group_id within the same source', async () => {
            const batch = [
                makeEnvelope({ group_id: 'chat_a' }),
                makeEnvelope({ group_id: 'chat_a' }),
                makeEnvelope({ group_id: 'chat_b' }),
                makeEnvelope({ group_id: 'chat_b' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            for (const c of chunks) {
                const groupId = c.envelopes[0].payload.group_id;
                expect(
                    c.envelopes.every((e) => e.payload.group_id === groupId),
                ).toBe(true);
            }
        });

        it('groups by channel_id within the same source and group', async () => {
            const batch = [
                makeEnvelope({ group_id: 'chat_a', channel_id: 'chan_1' }),
                makeEnvelope({ group_id: 'chat_a', channel_id: 'chan_1' }),
                makeEnvelope({ group_id: 'chat_a', channel_id: 'chan_2' }),
                makeEnvelope({ group_id: 'chat_a', channel_id: 'chan_2' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            for (const c of chunks) {
                const channelId = c.envelopes[0].payload.channel_id;
                expect(
                    c.envelopes.every(
                        (e) => e.payload.channel_id === channelId,
                    ),
                ).toBe(true);
            }
        });
    });

    describe('fingerprint', () => {
        it('builds correct deep fingerprint path', async () => {
            const batch = [
                makeEnvelope({
                    source_plugin: 'telegram',
                    group_id: 'chat_99',
                    channel_id: 'chan_1',
                }),
                makeEnvelope({
                    source_plugin: 'telegram',
                    group_id: 'chat_99',
                    channel_id: 'chan_1',
                }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).toMatch(
                /^source:telegram\/group-id:chat_99\/channel-id:chan_1\/start:\d+$/,
            );
        });

        it('uses /minimal suffix for groups below minMessages', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
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

        it('uses /start:timestamp for chunker-produced chunks', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).toMatch(/\/start:\d+$/);
        });
    });

    describe('minMessages', () => {
        it('yields minimal chunks for groups below threshold instead of dropping them', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_b' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            for (const c of chunks) {
                expect(c.id).toMatch(/\/minimal$/);
                expect(c.envelopes).toHaveLength(1);
                expect(c.metadata.envelopeCount).toBe(1);
            }
        });

        it('passes groups at or above threshold to the inner chunker', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).not.toMatch(/\/minimal$/);
            expect(chunks[0].id).toMatch(/\/start:\d+$/);
        });

        it('preserves all envelopes regardless of group size', async () => {
            const batch = [
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_a' }),
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_b' }),
                makeEnvelope({ source_plugin: 'telegram', group_id: 'chat_c' }),
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

        it('groups null group_id under __null__ key', async () => {
            const batch = [
                makeEnvelope({ group_id: null }),
                makeEnvelope({ group_id: 'chat_a' }),
                makeEnvelope({ group_id: null }),
            ];

            const chunks: DataChunk[] = [];
            for await (const chunk of strategy.run(batch)) {
                chunks.push(chunk);
            }

            expect(chunks).toHaveLength(2);
            const nullChunk = chunks.find((c) => c.id.includes('__null__'));
            expect(nullChunk).toBeDefined();
            expect(nullChunk.envelopes).toHaveLength(2);
        });

        it('handles envelopes with same timestamp', async () => {
            const now = new Date().toISOString();
            const batch = [
                makeEnvelope({
                    source_plugin: 'telegram',
                    group_id: 'chat_a',
                    occurred_at: now,
                }),
                makeEnvelope({
                    source_plugin: 'telegram',
                    group_id: 'chat_a',
                    occurred_at: now,
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
