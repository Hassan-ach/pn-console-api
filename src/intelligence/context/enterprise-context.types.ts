import { PreviousIntelligenceQuery } from './previous-intelligence-query.type';
import { RetrievalWindow } from './retrieval-window.type';
import { Insight } from '../../types/insight.types';
import { EnvelopeWithPayload } from '../../types/envelope.types';

export interface EnterpriseContext {
    organizationId: string;
    window: RetrievalWindow;
    metadata: Record<string, unknown>;
    envelopes: EnvelopeWithPayload[];
    previousIntelligence(query: PreviousIntelligenceQuery): Promise<Insight[]>;
}
