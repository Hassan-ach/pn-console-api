import { EnvelopeWithPayload } from '../../types/envelope.types';
import { ChunkingStrategy } from './chunking-strategy.interface';
import { Partitioner } from './partitioners/partitioner.interface';
import { DataChunk } from './types/data-chunk.type';

export interface CompositeChunkingOptions {
    partitioners: Partitioner[];
    chunker: ChunkingStrategy;
    minMessages: number;
}

interface GroupWithFingerprint {
    envelopes: EnvelopeWithPayload[];
    fingerprint: string;
}

export class CompositeChunkingStrategy implements ChunkingStrategy {
    readonly name = 'composite';
    private readonly partitioners: Partitioner[];
    private readonly chunker: ChunkingStrategy;
    private readonly minMessages: number;

    constructor(options: CompositeChunkingOptions) {
        this.partitioners = options.partitioners;
        this.chunker = options.chunker;
        this.minMessages = options.minMessages;
    }

    async *run(batch: EnvelopeWithPayload[]): AsyncIterable<DataChunk> {
        let groups: GroupWithFingerprint[] = [
            { envelopes: batch, fingerprint: '' },
        ];

        for (const partitioner of this.partitioners) {
            const next: GroupWithFingerprint[] = [];
            for (const group of groups) {
                const results = partitioner.split(group.envelopes);
                for (const { key, envelopes } of results) {
                    const fingerprint = group.fingerprint
                        ? `${group.fingerprint}/${partitioner.name}:${key}`
                        : `${partitioner.name}:${key}`;
                    next.push({ envelopes, fingerprint });
                }
            }
            groups = next;
        }

        for (const group of groups) {
            if (group.envelopes.length < this.minMessages) {
                yield this.buildMinimalChunk(group);
                continue;
            }
            for await (const chunk of this.chunker.run(group.envelopes)) {
                yield {
                    ...chunk,
                    id: `${group.fingerprint}/start:${chunk.metadata.timeRange.start.getTime()}`,
                };
            }
        }
    }

    private buildMinimalChunk(group: GroupWithFingerprint): DataChunk {
        const times = group.envelopes
            .map((e) => new Date(e.envelope.occurred_at).getTime())
            .sort((a, b) => a - b);
        return {
            id: `${group.fingerprint}/minimal`,
            envelopes: group.envelopes,
            metadata: {
                timeRange: {
                    start: new Date(times[0]),
                    end: new Date(times[times.length - 1]),
                },
                envelopeCount: group.envelopes.length,
            },
        };
    }
}
