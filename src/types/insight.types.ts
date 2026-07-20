export const InsightType = {
    TASK: 'TASK',
    URGENCY: 'URGENCY',
    INFO: 'INFO',
    DECISION: 'DECISION',
} as const;

export type InsightType = (typeof InsightType)[keyof typeof InsightType];

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
    latestVersionId?: string;
    createdAt?: Date;
    sourcePlugin?: string;
    groupId?: string;
    channelId?: string;
    topicId?: string;
}
