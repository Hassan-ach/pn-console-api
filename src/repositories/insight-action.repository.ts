import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { InsightActionStatus } from 'src/types/insight.types';

@Injectable()
export class InsightActionRepository {
    constructor(private readonly prisma: AppDbService) {}

    async upsert(
        insightVersionId: string,
        userId: string,
        status: InsightActionStatus,
    ) {
        return this.prisma.insightVersionOwner.upsert({
            where: {
                insightVersionId_userId: {
                    insightVersionId,
                    userId,
                },
            },
            create: {
                insightVersionId,
                userId,
                status,
            },
            update: {
                status,
            },
        });
    }

    async getLatestStatusByInsightAndUser(
        insightId: string,
        userId: string,
    ): Promise<InsightActionStatus | null> {
        const latestVersion = await this.prisma.insightVersion.findFirst({
            where: { insightId },
            orderBy: { version: 'desc' },
            select: { id: true },
        });

        if (!latestVersion) return null;

        const ownerRow = await this.prisma.insightVersionOwner.findUnique({
            where: {
                insightVersionId_userId: {
                    insightVersionId: latestVersion.id,
                    userId,
                },
            },
            select: { status: true },
        });

        return ownerRow?.status ?? null;
    }

    async upsertPriority(
        insightVersionId: string,
        userId: string,
        priority: number,
    ) {
        return this.prisma.insightVersionOwner.upsert({
            where: {
                insightVersionId_userId: {
                    insightVersionId,
                    userId,
                },
            },
            create: {
                insightVersionId,
                userId,
                priority,
            },
            update: {
                priority,
            },
        });
    }
}
