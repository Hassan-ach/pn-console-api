import { Inject, Injectable, Logger } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../types/envelope.types';
import { ChunkingStrategy } from './chunking-strategy.interface';
import { CHUNKING_STRATEGY } from './chunking.token';
import { DataChunk } from './types/data-chunk.type';

@Injectable()
export class ChunkingPipeline {
    private readonly logger = new Logger(ChunkingPipeline.name);

    constructor(
        @Inject(CHUNKING_STRATEGY)
        private readonly strategies: ChunkingStrategy[],
    ) {}

    async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
        this.logger.debug(
            `Chunking ${batch.length} envelopes with ${this.strategies.length} strategies`,
        );

        let totalChunks = 0;
        for (const strategy of this.strategies) {
            for await (const chunk of strategy.run(batch)) {
                totalChunks++;
                this.logger.debug(
                    `Chunk produced: [${chunk.id}] ${chunk.metadata.envelopeCount} envelopes, timeRange=${chunk.metadata.timeRange.start.toISOString()}..${chunk.metadata.timeRange.end.toISOString()}`,
                );
                yield chunk;
            }
        }
        this.logger.debug(
            `Chunking complete: ${totalChunks} chunks from ${batch.length} envelopes`,
        );
    }
}
