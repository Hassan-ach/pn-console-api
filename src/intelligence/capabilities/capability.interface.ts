import { DataChunk } from '../chunking/types/data-chunk.type';
import { Insight } from '../../types/insight.types';

export interface CapabilityInput {
    chunk: DataChunk;
    previousIntelligence: Insight[];
    organizationId?: string;
}

export interface CapabilityResult {
    capabilityName: string;
    insights: Insight[];
}

export interface ICapability {
    readonly name: string;
    execute(input: CapabilityInput): Promise<CapabilityResult>;
}
