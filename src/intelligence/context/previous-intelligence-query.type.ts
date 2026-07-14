export interface PreviousIntelligenceQuery {
    scope?: {
        sourcePlugin?: string;
        groupId?: string;
        channelId?: string;
        topicId?: string;
    };

    limit?: number;
}
