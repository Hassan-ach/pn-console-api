import { Injectable } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { Partitioner, PartitionResult } from '../interfaces/partitioner.interface';

export interface DailyPartitionerOptions {
    minChunkMessages: number;
    maxChunkMessages: number;
}

@Injectable()
export class DailyPartitioner implements Partitioner {
    readonly name = 'daily';
    private readonly minChunkMessages: number;
    private readonly maxChunkMessages: number;

    constructor(options: DailyPartitionerOptions) {
        this.minChunkMessages = options.minChunkMessages;
        this.maxChunkMessages = options.maxChunkMessages;
    }

    split(group: EnvelopeWithPayload[]): PartitionResult[] {
        if (group.length < this.minChunkMessages) {
            return [{ key: 'all', envelopes: group }];
        }

        const dailyMap = new Map<string, EnvelopeWithPayload[]>();
        for (const item of group) {
            const date = item.envelope.occurredAt.toISOString().slice(0, 10);
            const bucket = dailyMap.get(date);
            if (bucket) bucket.push(item);
            else dailyMap.set(date, [item]);
        }

        const sortedDates = Array.from(dailyMap.keys()).sort();
        const merged: PartitionResult[] = [];
        for (const date of sortedDates) {
            const bucket = dailyMap.get(date)!;
            const last = merged[merged.length - 1];

            if (
                last &&
                last.envelopes.length < this.minChunkMessages &&
                last.envelopes.length + bucket.length <= this.maxChunkMessages
            ) {
                last.key += `+${date}`;
                last.envelopes = [...last.envelopes, ...bucket];
            } else {
                merged.push({ key: date, envelopes: [...bucket] });
            }
        }

        return merged;
    }
}
