import { Inject, Injectable } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../types/envelope.types';
import { ChunkingStrategy } from './chunking-strategy.interface';
import { CHUNKING_STRATEGY } from './chunking.token';
import { DataChunk } from './types/data-chunk.type';

@Injectable()
export class ChunkingPipeline {
    constructor(
        @Inject(CHUNKING_STRATEGY)
        private readonly strategies: ChunkingStrategy[],
    ) {}

    async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
        for (const strategy of this.strategies) {
            for await (const chunk of strategy.run(batch)) {
                yield chunk;
            }
        }
    }
}
