import { EnvelopeWithPayload } from '../../types/envelope.types';
import { DataChunk } from './types/data-chunk.type';

export interface ChunkingStrategy {
    readonly name: string;
    run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk>;
}
