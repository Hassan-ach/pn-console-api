import { Insight } from '../../../types/insight.types';
import { EnvelopeWithPayload } from '../../../types/envelope.types';

export interface RetrievalWindow {
    start: Date;
    end: Date;
    messageCount: number;
}

export interface PreviousIntelligenceQuery {
    scope?: {
        sourcePlugin?: string;
        groupId?: string;
        channelId?: string;
        topicId?: string;
    };
    limit?: number;
}

export interface EnterpriseContext {
    organizationId: string;
    window: RetrievalWindow;
    metadata: Record<string, unknown>;
    envelopes: EnvelopeWithPayload[];
    previousIntelligence(query: PreviousIntelligenceQuery): Promise<Insight[]>;
}
