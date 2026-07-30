import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import {
    Prisma,
    SuggestionActionType,
    SuggestionStatus,
} from 'generated/app-db-client';

export interface CreateSuggestionInput {
    insightId: string;
    organizationId?: string;
    title: string;
    description: string;
    actionType?: SuggestionActionType;
    reasoning?: string;
    status?: SuggestionStatus;
    metadata?: Record<string, any>;
}

@Injectable()
export class InsightSuggestionRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: CreateSuggestionInput) {
        return this.prisma.insightSuggestion.create({
            data: {
                insightId: data.insightId,
                organizationId: data.organizationId ?? null,
                title: data.title,
                description: data.description,
                actionType:
                    data.actionType ?? SuggestionActionType.RECOMMENDATION,
                reasoning: data.reasoning ?? null,
                status: data.status ?? SuggestionStatus.PENDING,
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
        });
    }

    async createMany(records: CreateSuggestionInput[]): Promise<number> {
        if (records.length === 0) return 0;
        const result = await this.prisma.insightSuggestion.createMany({
            data: records.map((r) => ({
                insightId: r.insightId,
                organizationId: r.organizationId ?? null,
                title: r.title,
                description: r.description,
                actionType: r.actionType ?? SuggestionActionType.RECOMMENDATION,
                reasoning: r.reasoning ?? null,
                status: r.status ?? SuggestionStatus.PENDING,
                metadata: (r.metadata as Prisma.InputJsonValue) ?? {},
            })),
        });
        return result.count;
    }

    async findById(id: string) {
        return this.prisma.insightSuggestion.findUnique({
            where: { id },
            include: {
                insight: {
                    include: {
                        versions: {
                            orderBy: { version: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });
    }

    async findByInsightId(insightId: string) {
        return this.prisma.insightSuggestion.findMany({
            where: { insightId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findByOrganizationId(
        organizationId?: string,
        options?: { status?: SuggestionStatus; limit?: number },
    ) {
        return this.prisma.insightSuggestion.findMany({
            where: {
                ...(organizationId ? { organizationId } : {}),
                ...(options?.status ? { status: options.status } : {}),
            },
            include: {
                insight: {
                    include: {
                        versions: {
                            orderBy: { version: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: options?.limit ?? 50,
        });
    }

    async updateStatus(id: string, status: SuggestionStatus) {
        return this.prisma.insightSuggestion.update({
            where: { id },
            data: { status },
        });
    }

    async deleteByInsightId(insightId: string): Promise<number> {
        const result = await this.prisma.insightSuggestion.deleteMany({
            where: { insightId },
        });
        return result.count;
    }

    async delete(id: string) {
        return this.prisma.insightSuggestion.delete({
            where: { id },
        });
    }
}
