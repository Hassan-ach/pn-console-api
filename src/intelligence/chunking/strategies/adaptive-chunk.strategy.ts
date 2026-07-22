import { Injectable, Logger } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { ChunkingStrategy } from '../interfaces/chunking-strategy.interface';
import { DataChunk } from '../types/data-chunk.type';

export interface AdaptiveChunkOptions {
    maxMessages: number;
    strategies: ChunkingStrategy[];
}

@Injectable()
export class AdaptiveChunkStrategy implements ChunkingStrategy {
    readonly name = 'adaptive';
    private readonly logger = new Logger(AdaptiveChunkStrategy.name);

    private readonly maxMessages: number;
    private readonly strategies: ChunkingStrategy[];

    constructor(options: AdaptiveChunkOptions) {
        this.maxMessages = options.maxMessages;
        this.strategies = options.strategies;
    }

    async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
        this.logger.debug(
            `AdaptiveChunk run: ${batch.length} envelopes, ${this.strategies.length} strategies`,
        );
        yield* this.splitRecursive(batch, 0);
    }

    private async *splitRecursive(
        batch: EnvelopeWithPayload[],
        stepIndex: number,
    ): AsyncIterable<DataChunk> {
        this.logger.debug(
            `splitRecursive step=${stepIndex} batch=${batch.length} max=${this.maxMessages}`,
        );

        if (batch.length <= this.maxMessages) {
            this.logger.debug(
                `splitRecursive step=${stepIndex}: batch=${batch.length} ≤ ${this.maxMessages} → emitting as single chunk`,
            );
            yield this.buildChunk(batch);
            return;
        }

        if (stepIndex >= this.strategies.length) {
            this.logger.debug(
                `splitRecursive: strategies exhausted (step=${stepIndex}), force-splitting ${batch.length} by ${this.maxMessages}`,
            );
            const sorted = [...batch].sort(
                (a, b) =>
                    a.envelope.occurredAt.getTime() -
                    b.envelope.occurredAt.getTime(),
            );
            const parts = Math.ceil(sorted.length / this.maxMessages);
            for (let i = 0; i < sorted.length; i += this.maxMessages) {
                const slice = sorted.slice(i, i + this.maxMessages);
                this.logger.debug(
                    `force-split: part ${Math.floor(i / this.maxMessages) + 1}/${parts} (${slice.length} msgs)`,
                );
                yield this.buildChunk(slice);
            }
            return;
        }

        this.logger.debug(
            `splitRecursive step=${stepIndex}: applying strategy #${stepIndex} to ${batch.length} envelopes`,
        );
        const strategy = this.strategies[stepIndex];
        let subCount = 0;
        for await (const subChunk of strategy.run(batch)) {
            subCount++;
            yield* this.splitRecursive(subChunk.envelopes, stepIndex + 1);
        }
        this.logger.debug(
            `splitRecursive step=${stepIndex}: strategy produced ${subCount} sub-chunks`,
        );
    }

    private buildChunk(envelopes: EnvelopeWithPayload[]): DataChunk {
        const sorted = [...envelopes].sort(
            (a, b) =>
                a.envelope.occurredAt.getTime() -
                b.envelope.occurredAt.getTime(),
        );
        return {
            id: `${sorted[0].envelope.sourcePlugin}_${sorted[0].envelope.occurredAt.getTime()}`,
            envelopes: sorted,
            metadata: {
                timeRange: {
                    start: sorted[0].envelope.occurredAt,
                    end: sorted[sorted.length - 1].envelope.occurredAt,
                },
                envelopeCount: sorted.length,
            },
        };
    }
}
