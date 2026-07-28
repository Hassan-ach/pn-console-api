import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import chunkingConfig from '../../../config/chunking.config';

import { ChunkingModule } from '../chunking.module';
import { ChunkingPipeline } from './chunking-pipeline.service';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { DataChunk } from '../types/data-chunk.type';

interface RawExportItem {
    envelope: {
        id: string;
        source_plugin: string;
        source_id: string;
        type: string;
        has_attachment: boolean;
        author_id: string;
        organization_id: string;
        status: string;
        permissions: Record<string, unknown>;
        occurred_at: string;
    };
    payload: {
        id: string;
        type: string;
        content: string;
        group_id: string | null;
        channel_id: string | null;
        topic_id: string | null;
        reply_to: string | null;
        reactions: Record<string, unknown>;
        pinned: boolean;
        edited_date: string | null;
        entities: unknown;
        raw_payload: unknown;
    };
}

describe('ChunkingPipeline (real exported dataset)', () => {
    let pipeline: ChunkingPipeline;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [chunkingConfig],
                }),
                ChunkingModule,
            ],
        }).compile();

        pipeline = moduleRef.get(ChunkingPipeline);
    });

    it('chunks the exported dataset without losing envelopes', async () => {
        const raw = JSON.parse(
            readFileSync(join(process.cwd(), 'reports', 'export.json'), 'utf8'),
        ) as RawExportItem[];

        const batch: EnvelopeWithPayload[] = raw.map((item: RawExportItem) => ({
            envelope: {
                id: item.envelope.id,
                sourcePlugin: item.envelope.source_plugin,
                sourceId: item.envelope.source_id,
                type: item.envelope.type as 'message',
                hasAttachment: item.envelope.has_attachment,
                authorId: item.envelope.author_id,
                organizationId: item.envelope.organization_id,
                status: item.envelope.status,
                permissions: item.envelope.permissions ?? {},
                occurredAt: new Date(item.envelope.occurred_at),
            },
            payload: {
                id: item.payload.id,
                type: item.payload.type as 'direct' | 'email',
                content: item.payload.content,
                groupId: item.payload.group_id,
                channelId: item.payload.channel_id,
                topicId: item.payload.topic_id,
                replyTo: item.payload.reply_to,
                reactions: item.payload.reactions ?? {},
                pinned: item.payload.pinned,
                editedDate: item.payload.edited_date
                    ? new Date(item.payload.edited_date)
                    : null,
                entities: item.payload.entities as Record<
                    string,
                    unknown
                > | null,
                rawPayload: item.payload.raw_payload as Record<string, unknown>,
            },
        }));

        // Validate imported data.
        for (const envelope of batch) {
            expect(Number.isNaN(envelope.envelope.occurredAt.getTime())).toBe(
                false,
            );
        }

        const chunks: DataChunk[] = [];

        for await (const chunk of pipeline.run(batch)) {
            chunks.push(chunk);
        }

        // Validate chunk metadata.
        for (const chunk of chunks) {
            expect(chunk.metadata.envelopeCount).toBe(chunk.envelopes.length);

            expect(Number.isNaN(chunk.metadata.timeRange.start.getTime())).toBe(
                false,
            );

            expect(Number.isNaN(chunk.metadata.timeRange.end.getTime())).toBe(
                false,
            );
        }

        // Ensure every envelope appears exactly once.
        const seen = new Set<string>();

        for (const chunk of chunks) {
            for (const envelope of chunk.envelopes) {
                expect(seen.has(envelope.envelope.id!)).toBe(false);
                seen.add(envelope.envelope.id!);
            }
        }

        expect(seen.size).toBe(batch.length);

        console.log('\n========== Chunk Summary ==========');
        console.log(`Input envelopes : ${batch.length}`);
        console.log(`Generated chunks: ${chunks.length}`);

        console.table(
            chunks.map((chunk) => ({
                id: chunk.id,
                envelopes: chunk.metadata.envelopeCount,
                start: chunk.metadata.timeRange.start.toISOString(),
                end: chunk.metadata.timeRange.end.toISOString(),
            })),
        );
    });
});
