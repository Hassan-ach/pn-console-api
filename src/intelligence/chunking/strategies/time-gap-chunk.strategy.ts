import { Injectable } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { ChunkingStrategy } from '../chunking-strategy.interface';
import { DataChunk } from '../types/data-chunk.type';

export interface TimeGapChunkOptions {
    gapMinutes?: number;
    maxWindowMinutes?: number;
}

@Injectable()
export class TimeGapChunkStrategy implements ChunkingStrategy {
    readonly name = 'time-gap';
    private readonly gapMs: number;
    private readonly maxWindowMs: number;

    constructor(options?: TimeGapChunkOptions) {
        this.gapMs = (options?.gapMinutes ?? 30) * 60 * 1000;
        this.maxWindowMs = (options?.maxWindowMinutes ?? 240) * 60 * 1000;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
        if (batch.length === 0) return;

        const sorted = [...batch].sort(
            (a, b) =>
                new Date(a.envelope.occurred_at).getTime() -
                new Date(b.envelope.occurred_at).getTime(),
        );

        let chunkStart = 0;
        let windowStartTime = new Date(
            sorted[0].envelope.occurred_at,
        ).getTime();

        for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1].envelope.occurred_at).getTime();
            const curr = new Date(sorted[i].envelope.occurred_at).getTime();
            const gap = curr - prev;
            const windowElapsed = curr - windowStartTime;

            if (gap > this.gapMs || windowElapsed > this.maxWindowMs) {
                yield this.buildChunk(
                    sorted.slice(chunkStart, i),
                    windowStartTime,
                    prev,
                );
                chunkStart = i;
                windowStartTime = curr;
            }
        }

        yield this.buildChunk(
            sorted.slice(chunkStart),
            windowStartTime,
            new Date(sorted[sorted.length - 1].envelope.occurred_at).getTime(),
        );
    }

    private buildChunk(
        envelopes: EnvelopeWithPayload[],
        start: number,
        end: number,
    ): DataChunk {
        return {
            id: `${envelopes[0].envelope.source_plugin}_${start}`,
            envelopes,
            metadata: {
                timeRange: { start: new Date(start), end: new Date(end) },
                envelopeCount: envelopes.length,
            },
        };
    }
}
