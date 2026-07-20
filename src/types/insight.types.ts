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

export const InsightActionStatus = {
    PENDING: 'PENDING',
    NOTED: 'NOTED',
    DONE: 'DONE',
    BLOCKED: 'BLOCKED',
    IN_REVIEW: 'IN_REVIEW',
    DECIDED: 'DECIDED',
    DELEGATED: 'DELEGATED',
    DELAYED: 'DELAYED',
    HIDDEN: 'HIDDEN',
} as const;

export type InsightActionStatus =
    (typeof InsightActionStatus)[keyof typeof InsightActionStatus];

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
    status?: InsightActionStatus;
    channelId?: string;
    topicId?: string;
}
