import { Injectable } from '@nestjs/common';
import { RawDbService } from 'src/prisma/raw-db/raw-db.service';

export interface CapabilityFailureRecord {
    id: string;
    capabilityName: string;
    chunkId: string;
    errorMessage: string;
    envelopeIds: string[];
    organizationId: string;
    createdAt: Date;
    resolved: boolean;
}

@Injectable()
export class CapabilityFailureRepository {
    constructor(private readonly rawDb: RawDbService) {}

    async create(data: {
        capabilityName: string;
        chunkId: string;
        errorMessage: string;
        envelopeIds: string[];
        organizationId: string;
    }): Promise<CapabilityFailureRecord> {
        return this.rawDb.capabilityFailure.create({ data });
    }

    async createMany(
        records: Array<{
            capabilityName: string;
            chunkId: string;
            errorMessage: string;
            envelopeIds: string[];
            organizationId: string;
        }>,
    ): Promise<number> {
        if (records.length === 0) return 0;
        const result = await this.rawDb.capabilityFailure.createMany({
            data: records,
        });
        return result.count;
    }

    async findByOrganizationId(
        organizationId: string,
        options?: { resolved?: boolean; limit?: number },
    ): Promise<CapabilityFailureRecord[]> {
        return this.rawDb.capabilityFailure.findMany({
            where: {
                organizationId,
                ...(options?.resolved !== undefined
                    ? { resolved: options.resolved }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: options?.limit ?? 50,
        });
    }

    async markResolved(ids: string[]): Promise<number> {
        const result = await this.rawDb.capabilityFailure.updateMany({
            where: { id: { in: ids } },
            data: { resolved: true },
        });
        return result.count;
    }
}
