import { EnvelopeWithPayload } from '../../../types/envelope.types';

export interface PartitionResult {
    key: string;
    envelopes: EnvelopeWithPayload[];
}

export interface Partitioner {
    readonly name: string;
    split(group: EnvelopeWithPayload[]): PartitionResult[];
}
