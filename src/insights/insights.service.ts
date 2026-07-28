import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InsightActionRepository } from '../repositories/insight-action.repository';
import { InsightRepository } from '../repositories/insight.repository';
import {
    Insight,
    InsightActionStatus,
    InsightType,
    INSIGHT_ACTION_MAP,
} from '../types/insight.types';

@Injectable()
export class InsightsService {
    constructor(
        private readonly insightRepository: InsightRepository,
        private readonly insightActionRepository: InsightActionRepository,
    ) {}

    async findAllForUser(
        userId: string,
        type?: InsightType,
        status?: InsightActionStatus,
    ): Promise<
        {
            id: string;
            type: InsightType;
            content: string;
            status: InsightActionStatus;
            priority: number;
            deadline?: Date;
        }[]
    > {
        return this.insightRepository.findByOwnerId(userId, type, status);
    }

    async findOneForUser(id: string, userId: string): Promise<Insight> {
        const insight = await this.insightRepository.findById(id, userId);

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        return insight;
    }

    async updateActionStatus(
        id: string,
        userId: string,
        action: InsightActionStatus,
    ): Promise<Insight> {
        const insight = await this.insightRepository.findById(id, userId);

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        const allowed = INSIGHT_ACTION_MAP[insight.type];
        if (!allowed.includes(action)) {
            throw new BadRequestException(
                `Action ${action} is not valid for insight type ${insight.type}`,
            );
        }

        const latestVersionId =
            await this.insightRepository.getLatestVersionId(id);

        if (!latestVersionId) {
            throw new NotFoundException('Insight version not found');
        }

        await this.insightActionRepository.upsert(
            latestVersionId,
            userId,
            action,
        );

        return this.insightRepository.findById(id, userId) as Promise<Insight>;
    }

    async updatePriority(
        id: string,
        userId: string,
        priority: number,
    ): Promise<Insight> {
        const insight = await this.insightRepository.findById(id, userId);

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        const latestVersionId =
            await this.insightRepository.getLatestVersionId(id);

        if (!latestVersionId) {
            throw new NotFoundException('Insight version not found');
        }

        await this.insightActionRepository.upsertPriority(
            latestVersionId,
            userId,
            priority,
        );

        return this.insightRepository.findById(id, userId) as Promise<Insight>;
    }

    async findVersionsForUser(
        id: string,
        userId: string,
    ): Promise<
        {
            id: string;
            version: number;
            type: InsightType;
            content: string;
            status?: InsightActionStatus;
            priority?: number;
            deadline?: Date;
        }[]
    > {
        const versions = await this.insightRepository.findVersionsByInsightId(
            id,
            userId,
        );

        if (!versions) {
            throw new NotFoundException('Insight not found');
        }

        return versions;
    }

    async findVersionForUser(
        id: string,
        versionId: string,
        userId: string,
    ): Promise<{
        id: string;
        organizationId?: string;
        type: InsightType;
        content: string;
        envolopsRef: string[];
        broadcasted: boolean;
        version: number;
        latestVersionId?: string;
        createdAt: Date;
        sourcePlugin?: string;
        groupId?: string;
        channelId?: string;
        topicId?: string;
        status?: InsightActionStatus;
        priority?: number;
        deadline?: Date;
    }> {
        const version = await this.insightRepository.findVersionById(
            id,
            versionId,
            userId,
        );

        if (!version) {
            throw new NotFoundException('Insight version not found');
        }

        return version;
    }

    async findVersionEnvelopeRefs(
        id: string,
        versionId: string,
        userId: string,
    ): Promise<
        {
            envolopId: string;
            sourcePlugin: string;
            occurredAt: Date;
            content: string;
        }[]
    > {
        const refs = await this.insightRepository.findVersionEnvelopeRefs(
            id,
            versionId,
            userId,
        );

        if (refs === null) {
            throw new NotFoundException('Insight version not found');
        }

        return refs;
    }
}
