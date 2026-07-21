import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import {
    Insight,
    InsightActionStatus,
    InsightType,
    UnresolvedOwnerRef,
} from 'src/types/insight.types';
import { EnvelopeRepository } from './envelope.repository';

@Injectable()
export class InsightRepository {
    constructor(
        private readonly prisma: AppDbService,
        private readonly envelopeRepository: EnvelopeRepository,
    ) {}

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
                            create: data.owners.map((userId) => ({
                                userId,
                                status: 'PENDING' as const,
                            })),
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
                    include: {
                        owners: true,
                        unresolvedOwners: true,
                    },
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
                        create: data.owners.map((userId) => ({
                            userId,
                            status: 'PENDING' as const,
                        })),
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
                        include: {
                            owners: true,
                            unresolvedOwners: true,
                        },
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
                    include: {
                        owners: true,
                        unresolvedOwners: true,
                    },
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
                    include: {
                        owners: true,
                        unresolvedOwners: true,
                    },
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
            include: {
                owners: true,
                unresolvedOwners: true,
            },
        });

        return versions.map((v) => ({
            id: v.insightId,
            organizationId,
            type: v.type,
            content: v.content,
            owners: v.owners.map((o) => o.userId),
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

    async findByOwnerId(
        ownerId: string,
        type?: InsightType,
    ): Promise<
        {
            id: string;
            type: InsightType;
            content: string;
            status: InsightActionStatus | null;
        }[]
    > {
        const versions = await this.prisma.insightVersion.findMany({
            where: {
                OR: [
                    { owners: { some: { userId: ownerId } } },
                    { broadcasted: true },
                ],
                ...(type && { type }),
            },
            select: {
                id: true,
                insightId: true,
                type: true,
                content: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const seen = new Set<string>();
        const latestVersionIds: { insightId: string; versionId: string }[] = [];

        for (const v of versions) {
            if (!seen.has(v.insightId)) {
                seen.add(v.insightId);
                latestVersionIds.push({
                    insightId: v.insightId,
                    versionId: v.id,
                });
            }
        }

        if (latestVersionIds.length === 0) return [];

        const ownerRows = await this.prisma.insightVersionOwner.findMany({
            where: {
                userId: ownerId,
                insightVersionId: {
                    in: latestVersionIds.map((v) => v.versionId),
                },
            },
            select: {
                insightVersionId: true,
                status: true,
            },
        });

        const statusMap = new Map(
            ownerRows.map((r) => [r.insightVersionId, r.status]),
        );

        const results: {
            id: string;
            type: InsightType;
            content: string;
            status: InsightActionStatus | null;
        }[] = [];

        for (const v of versions) {
            if (seen.has(v.insightId)) {
                seen.delete(v.insightId);
                results.push({
                    id: v.insightId,
                    type: v.type,
                    content: v.content,
                    status: statusMap.get(v.id) ?? null,
                });
            }
        }

        return results;
    }

    async findById(id: string, ownerId: string): Promise<Insight | null> {
        const insight = await this.prisma.insight.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
                },
            },
        });

        if (!insight || insight.versions.length === 0) return null;

        const latest = insight.versions[0];
        const isOwner = latest.owners.some((o) => o.userId === ownerId);

        if (!isOwner && !latest.broadcasted) return null;

        const ownerRow = latest.owners.find((o) => o.userId === ownerId);

        return {
            id: insight.id,
            organizationId: insight.organizationId ?? undefined,
            type: latest.type,
            content: latest.content,
            envolopsRef: [...latest.envolopsRef],
            broadcasted: latest.broadcasted,
            version: latest.version,
            latestVersionId: latest.id,
            createdAt: latest.createdAt,
            sourcePlugin: latest.sourcePlugin ?? undefined,
            groupId: latest.groupId ?? undefined,
            channelId: latest.channelId ?? undefined,
            owners: latest.owners.map((o) => o.userId),
            topicId: latest.topicId ?? undefined,
            status: ownerRow?.status ?? undefined,
        };
    }

    async findVersionsByInsightId(
        insightId: string,
        ownerId: string,
    ): Promise<
        | {
              id: string;
              version: number;
              type: InsightType;
              content: string;
          }[]
        | null
    > {
        const insight = await this.prisma.insight.findUnique({
            where: { id: insightId },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
                },
            },
        });

        if (!insight || insight.versions.length === 0) return null;

        const latest = insight.versions[0];
        const isOwner = latest.owners.some((o) => o.userId === ownerId);
        if (!isOwner && !latest.broadcasted) return null;

        const allVersions = await this.prisma.insightVersion.findMany({
            where: { insightId },
            orderBy: { version: 'asc' },
            select: {
                id: true,
                version: true,
                type: true,
                content: true,
            },
        });

        return allVersions;
    }

    async findVersionById(
        insightId: string,
        versionId: string,
        ownerId: string,
    ): Promise<{
        id: string;
        organizationId?: string;
        type: InsightType;
        content: string;
        envolopsRef: string[];
        broadcasted: boolean;
        version: number;
        createdAt: Date;
        sourcePlugin?: string;
        groupId?: string;
        channelId?: string;
        topicId?: string;
    } | null> {
        const insight = await this.prisma.insight.findUnique({
            where: { id: insightId },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
                },
            },
        });

        if (!insight || insight.versions.length === 0) return null;

        const latest = insight.versions[0];
        const isOwner = latest.owners.some((o) => o.userId === ownerId);
        if (!isOwner && !latest.broadcasted) return null;

        const version = await this.prisma.insightVersion.findFirst({
            where: { id: versionId, insightId },
        });

        if (!version) return null;

        return {
            id: version.id,
            organizationId: insight.organizationId ?? undefined,
            type: version.type,
            content: version.content,
            envolopsRef: [...version.envolopsRef],
            broadcasted: version.broadcasted,
            version: version.version,
            createdAt: version.createdAt,
            sourcePlugin: version.sourcePlugin ?? undefined,
            groupId: version.groupId ?? undefined,
            channelId: version.channelId ?? undefined,
            topicId: version.topicId ?? undefined,
        };
    }

    async findVersionEnvelopeRefs(
        insightId: string,
        versionId: string,
        ownerId: string,
    ): Promise<
        | {
              envolopId: string;
              sourcePlugin: string;
              occurredAt: Date;
              content: string;
          }[]
        | null
    > {
        const insight = await this.prisma.insight.findUnique({
            where: { id: insightId },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
                },
            },
        });

        if (!insight || insight.versions.length === 0) return null;

        const latest = insight.versions[0];
        const isOwner = latest.owners.some((o) => o.userId === ownerId);
        if (!isOwner && !latest.broadcasted) return null;

        const version = await this.prisma.insightVersion.findFirst({
            where: { id: versionId, insightId },
        });

        if (!version) return null;

        return this.envelopeRepository.findByIds([...version.envolopsRef]);
    }

    async getLatestVersionId(insightId: string): Promise<string | null> {
        const version = await this.prisma.insightVersion.findFirst({
            where: { insightId },
            orderBy: { version: 'desc' },
            select: { id: true },
        });

        return version?.id ?? null;
    }

    private toInsight(row: {
        id: string;
        organizationId: string | null;
        versions: {
            version: number;
            type: string;
            content: string;
            owners: { userId: string }[];
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
            owners: latest.owners.map((o) => o.userId),
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
