import { Injectable } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import {
    Partitioner,
    PartitionResult,
} from '../interfaces/partitioner.interface';

@Injectable()
export class GroupIdPartitioner implements Partitioner {
    readonly name = 'group-id';

    split(group: EnvelopeWithPayload[]): PartitionResult[] {
        const map = new Map<string, EnvelopeWithPayload[]>();
        for (const item of group) {
            const key = item.payload.groupId ?? '__null__';
            const bucket = map.get(key);
            if (bucket) bucket.push(item);
            else map.set(key, [item]);
        }
        return Array.from(map, ([key, envelopes]) => ({ key, envelopes }));
    }
}
