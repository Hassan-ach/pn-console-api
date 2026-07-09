import { Injectable } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { Partitioner, PartitionResult } from './partitioner.interface';

@Injectable()
export class SourcePartitioner implements Partitioner {
    readonly name = 'source';

    split(group: EnvelopeWithPayload[]): PartitionResult[] {
        const map = new Map<string, EnvelopeWithPayload[]>();
        for (const item of group) {
            const key = item.envelope.sourcePlugin;
            const bucket = map.get(key);
            if (bucket) bucket.push(item);
            else map.set(key, [item]);
        }
        return Array.from(map, ([key, envelopes]) => ({ key, envelopes }));
    }
}
