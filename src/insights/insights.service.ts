import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InsightActionRepository } from '../repositories/insight-action.repository';
import { InsightRepository } from '../repositories/insight.repository';
import {
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

    async findAll(userId: string, type?: InsightType) {
        return this.insightRepository.findByOwnerId(userId, type);
    }

    async findOne(id: string, userId: string) {
        return this.insightRepository.findById(id, userId);
    }

    async updateActionStatus(
        id: string,
        userId: string,
        action: InsightActionStatus,
    ) {
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

        return this.insightRepository.findById(id, userId);
    }

    async findVersions(id: string, userId: string) {
        return this.insightRepository.findVersionsByInsightId(id, userId);
    }

    async findVersion(id: string, versionId: string, userId: string) {
        return this.insightRepository.findVersionById(id, versionId, userId);
    }

    async findVersionEnvelopeRefs(
        id: string,
        versionId: string,
        userId: string,
    ) {
        return this.insightRepository.findVersionEnvelopeRefs(
            id,
            versionId,
            userId,
        );
    }
}
