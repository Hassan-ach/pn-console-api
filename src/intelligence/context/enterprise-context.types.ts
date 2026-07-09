import { Insight } from '../../types/insight.types';
import { EnvelopeWithPayload } from '../../types/envelope.types';

export interface EnterpriseContext {
    organizationId: string;
    metadata: Record<string, unknown>;
    previousIntelligence(opts?: {
        maxItems?: number;
        windowStart?: Date;
        windowEnd?: Date;
    }): AsyncIterable<Insight[]>;
    envelopes(opts?: {
        ids?: string[];
        windowStart?: Date;
        windowEnd?: Date;
        maxBatchSize?: number;
    }): AsyncIterable<EnvelopeWithPayload[]>;
}
