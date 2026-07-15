export type InsightType = 'TASK' | 'URGENCY' | 'INFO' | 'DECISION';

export interface UnresolvedOwnerRef {
    platformUserId: string | null;
    platformUsername: string | null;
    pluginName: string;
}

export interface Insight {
    id: string | null;
    organizationId?: string;
    envolopsRef?: string[];
    broadcasted?: boolean;
    type: InsightType;
    content: string;
    owners: string[];
    unresolvedOwnerRefs?: UnresolvedOwnerRef[];
    version?: number;
    createdAt?: Date;
    sourcePlugin?: string;
    groupId?: string;
    channelId?: string;
    topicId?: string;
}
