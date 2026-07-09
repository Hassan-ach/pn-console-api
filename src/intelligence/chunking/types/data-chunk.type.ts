import { EnvelopeWithPayload } from '../../../types/envelope.types';

export interface DataChunk {
    id: string;
    envelopes: EnvelopeWithPayload[];
    metadata: {
        timeRange: { start: Date; end: Date };
        envelopeCount: number;
    };
}
