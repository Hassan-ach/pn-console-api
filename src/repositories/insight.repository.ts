import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Insight, InsightType } from 'src/types/insight.types';

@Injectable()
export class InsightRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: {
        organizationId?: string;
        type: InsightType;
        content: string;
        owners: string[];
        envolopsRef?: string[];
        broadcasted?: boolean;
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
                        broadcasted: data.broadcasted ?? false,
                        envolopsRef: data.envolopsRef ?? [],
                    },
                },
            },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
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
            envolopsRef?: string[];
            broadcasted?: boolean;
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
                    broadcasted: data.broadcasted ?? false,
                    envolopsRef: data.envolopsRef ?? [],
                },
            });

            const updated = await tx.insight.findUnique({
                where: { id },
                include: {
                    versions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: { owners: true },
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
                    include: { owners: true },
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
                    include: { owners: true },
                },
            },
        });

        return insights.map((i) => this.toInsight(i));
    }

    private toInsight(row: {
        id: string;
        organizationId: string | null;
        versions: {
            version: number;
            type: string;
            content: string;
            owners: { id: string }[];
            envolopsRef: string[];
            broadcasted: boolean;
            createdAt: Date;
        }[];
    }): Insight {
        const latest = row.versions[0];
        return {
            id: row.id,
            organizationId: row.organizationId ?? undefined,
            type: latest.type as Insight['type'],
            content: latest.content,
            owners: latest.owners.map((u) => u.id),
            envolopsRef: [...latest.envolopsRef],
            broadcasted: latest.broadcasted,
            version: latest.version,
            createdAt: latest.createdAt,
        };
    }
}
