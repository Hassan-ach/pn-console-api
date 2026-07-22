import { Logger } from '@nestjs/common';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { ChunkingStrategy } from '../interfaces/chunking-strategy.interface';
import { Partitioner } from '../interfaces/partitioner.interface';
import { DataChunk } from '../types/data-chunk.type';

export interface CompositeChunkingOptions {
    partitioners: Partitioner[];
}

interface GroupWithFingerprint {
    envelopes: EnvelopeWithPayload[];
    fingerprint: string;
}

export class CompositeChunkingStrategy implements ChunkingStrategy {
    readonly name = 'composite';
    private readonly logger = new Logger(CompositeChunkingStrategy.name);
    private readonly partitioners: Partitioner[];

    constructor(options: CompositeChunkingOptions) {
        this.partitioners = options.partitioners;
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
            const totalEnv = next.reduce((s, g) => s + g.envelopes.length, 0);
            this.logger.debug(
                `Partitioner "${partitioner.name}": ${groups.length} groups → ${next.length} groups (${totalEnv} envelopes)`,
            );
            groups = next;
        }

        for (const group of groups) {
            this.logger.debug(
                `Chunk [${group.fingerprint}]: ${group.envelopes.length} envelopes`,
            );
            // here i need to add time gap to oversized chunks
            yield this.buildMinimalChunk(group);
        }
    }

    private buildMinimalChunk(group: GroupWithFingerprint): DataChunk {
        const times = group.envelopes
            .map((e) => e.envelope.occurredAt.getTime())
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
