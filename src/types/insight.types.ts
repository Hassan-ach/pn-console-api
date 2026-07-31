export const InsightType = {
    TASK: 'TASK',
    URGENCY: 'URGENCY',
    INFO: 'INFO',
    DECISION: 'DECISION',
} as const;

export type InsightType = (typeof InsightType)[keyof typeof InsightType];

export const InsightBroadcastLevel = {
    DIRECT: 'DIRECT',
    ORG: 'ORG',
    TEAM: 'TEAM',
    ROLE: 'ROLE',
} as const;

export type InsightBroadcastLevel =
    (typeof InsightBroadcastLevel)[keyof typeof InsightBroadcastLevel];

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

export const INSIGHT_ACTION_MAP: Record<
    InsightType,
    readonly InsightActionStatus[]
> = {
    INFO: [InsightActionStatus.PENDING, InsightActionStatus.NOTED],
    TASK: [
        InsightActionStatus.PENDING,
        InsightActionStatus.DONE,
        InsightActionStatus.BLOCKED,
        InsightActionStatus.IN_REVIEW,
    ],
    DECISION: [
        InsightActionStatus.PENDING,
        InsightActionStatus.DECIDED,
        InsightActionStatus.DELEGATED,
        InsightActionStatus.DELAYED,
    ],
    URGENCY: [InsightActionStatus.PENDING, InsightActionStatus.HIDDEN],
};

export interface Insight {
    id: string | null;
    organizationId?: string;
    envolopsRef?: string[];
    broadcasted?: boolean;
    broadcastLevel?: InsightBroadcastLevel;
    broadcastTarget?: string;
    broadcastTargetId?: string;
    broadcastTargetName?: string;
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
    priority?: number;
    deadline?: Date;
    excludedUserIds?: string[];
}
