import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import {
    Insight,
    InsightType,
    UnresolvedOwnerRef,
} from 'src/types/insight.types';

@Injectable()
export class InsightRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: {
        organizationId?: string;
        type: InsightType;
        content: string;
        owners: string[];
        unresolvedOwners?: UnresolvedOwnerRef[];
        envolopsRef?: string[];
        broadcasted?: boolean;
        sourcePlugin?: string;
        groupId?: string;
        channelId?: string;
        topicId?: string;
    }): Promise<Insight> {
        const insight = await this.prisma.insight.create({
            data: {
                organizationId: data.organizationId ?? null,
                versions: {
                    create: {
                        version: 1,
                        type: data.type,
                        content: data.content,
                        owners: {
                            connect: data.owners.map((id) => ({ id })),
                        },
                        unresolvedOwners: {
                            create: (data.unresolvedOwners ?? []).map((u) => ({
                                platformUserId: u.platformUserId,
                                platformUsername: u.platformUsername,
                                pluginName: u.pluginName,
                            })),
                        },
                        broadcasted: data.broadcasted ?? false,
                        envolopsRef: data.envolopsRef ?? [],
                        sourcePlugin: data.sourcePlugin ?? null,
                        groupId: data.groupId ?? null,
                        channelId: data.channelId ?? null,
                        topicId: data.topicId ?? null,
                    },
                },
            },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true, unresolvedOwners: true },
                },
            },
        });

        return this.toInsight(insight);
    }

    async update(
        id: string,
        data: {
            type: InsightType;
            content: string;
            owners: string[];
            unresolvedOwners?: UnresolvedOwnerRef[];
            envolopsRef?: string[];
            broadcasted?: boolean;
            sourcePlugin?: string;
            groupId?: string;
            channelId?: string;
            topicId?: string;
        },
    ): Promise<Insight> {
        return this.prisma.$transaction(async (tx) => {
            await tx.insight.update({ where: { id }, data: {} });

            const latestVersions = await tx.insightVersion.groupBy({
                by: ['insightId'],
                where: { insightId: id },
                _max: { version: true },
            });

            const maxVersion = latestVersions[0]?._max.version ?? 0;

            await tx.insightVersion.create({
                data: {
                    insightId: id,
                    version: maxVersion + 1,
                    type: data.type,
                    content: data.content,
                    owners: {
                        connect: data.owners.map((id) => ({ id })),
                    },
                    unresolvedOwners: {
                        create: (data.unresolvedOwners ?? []).map((u) => ({
                            platformUserId: u.platformUserId,
                            platformUsername: u.platformUsername,
                            pluginName: u.pluginName,
                        })),
                    },
                    broadcasted: data.broadcasted ?? false,
                    envolopsRef: data.envolopsRef ?? [],
                    sourcePlugin: data.sourcePlugin ?? null,
                    groupId: data.groupId ?? null,
                    channelId: data.channelId ?? null,
                    topicId: data.topicId ?? null,
                },
            });

            const updated = await tx.insight.findUnique({
                where: { id },
                include: {
                    versions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: { owners: true, unresolvedOwners: true },
                    },
                },
            });

            return this.toInsight(updated!);
        });
    }

    async getAll(): Promise<Insight[]> {
        const insights = await this.prisma.insight.findMany({
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true, unresolvedOwners: true },
                },
            },
        });

        return insights.map((i) => this.toInsight(i));
    }

    async getAllByOrganizationId(organizationId: string): Promise<Insight[]> {
        const insights = await this.prisma.insight.findMany({
            where: { organizationId },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true, unresolvedOwners: true },
                },
            },
        });

        return insights.map((i) => this.toInsight(i));
    }

    async findByScope(
        organizationId: string,
        scope: {
            sourcePlugin?: string;
            groupId?: string | null;
            channelId?: string | null;
            topicId?: string | null;
        },
        limit: number,
    ): Promise<Insight[]> {
        const where: Record<string, unknown> = { organizationId };

        if (scope.sourcePlugin) where.sourcePlugin = scope.sourcePlugin;

        if (scope.channelId || scope.topicId || scope.groupId) {
            if (scope.channelId) where.channelId = scope.channelId;
            if (scope.topicId) where.topicId = scope.topicId;
            if (scope.groupId) where.groupId = scope.groupId;
        }

        const versions = await this.prisma.insightVersion.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { owners: true, unresolvedOwners: true },
        });

        return versions.map((v) => ({
            id: v.insightId,
            organizationId,
            type: v.type,
            content: v.content,
            owners: v.owners.map((u) => u.id),
            unresolvedOwnerRefs: v.unresolvedOwners.map((u) => ({
                platformUserId: u.platformUserId,
                platformUsername: u.platformUsername,
                pluginName: u.pluginName,
            })),
            envolopsRef: [...v.envolopsRef],
            broadcasted: v.broadcasted,
            version: v.version,
            createdAt: v.createdAt,
            sourcePlugin: v.sourcePlugin ?? undefined,
            groupId: v.groupId ?? undefined,
            channelId: v.channelId ?? undefined,
            topicId: v.topicId ?? undefined,
        }));
    }

    private toInsight(row: {
        id: string;
        organizationId: string | null;
        versions: {
            version: number;
            type: string;
            content: string;
            owners: { id: string }[];
            unresolvedOwners: {
                platformUserId: string | null;
                platformUsername: string | null;
                pluginName: string;
            }[];
            envolopsRef: string[];
            broadcasted: boolean;
            createdAt: Date;
            sourcePlugin: string | null;
            groupId: string | null;
            channelId: string | null;
            topicId: string | null;
        }[];
    }): Insight {
        const latest = row.versions[0];
        return {
            id: row.id,
            organizationId: row.organizationId ?? undefined,
            type: latest.type as Insight['type'],
            content: latest.content,
            owners: latest.owners.map((u) => u.id),
            unresolvedOwnerRefs: latest.unresolvedOwners.map((u) => ({
                platformUserId: u.platformUserId,
                platformUsername: u.platformUsername,
                pluginName: u.pluginName,
            })),
            envolopsRef: [...latest.envolopsRef],
            broadcasted: latest.broadcasted,
            version: latest.version,
            createdAt: latest.createdAt,
            sourcePlugin: latest.sourcePlugin ?? undefined,
            groupId: latest.groupId ?? undefined,
            channelId: latest.channelId ?? undefined,
            topicId: latest.topicId ?? undefined,
        };
    }
}
