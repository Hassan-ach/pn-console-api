import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

export interface UnresolvedOwner {
    id: string;
    platformUserId: string | null;
    platformUsername: string | null;
    pluginName: string;
    insightVersionId: string;
    createdAt: Date;
}

@Injectable()
export class UnresolvedOwnerRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: {
        platformUserId: string | null;
        platformUsername: string | null;
        pluginName: string;
        insightVersionId: string;
    }): Promise<UnresolvedOwner> {
        const owner = await this.prisma.unresolvedOwner.create({
            data: {
                platformUserId: data.platformUserId,
                platformUsername: data.platformUsername,
                pluginName: data.pluginName,
                insightVersionId: data.insightVersionId,
            },
        });

        return this.toUnresolvedOwner(owner);
    }

    async createMany(
        data: {
            platformUserId: string | null;
            platformUsername: string | null;
            pluginName: string;
            insightVersionId: string;
        }[],
    ): Promise<UnresolvedOwner[]> {
        if (data.length === 0) return [];

        const owners = await Promise.all(
            data.map((d) => this.prisma.unresolvedOwner.create({ data: d })),
        );

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async findByInsightVersionId(
        insightVersionId: string,
    ): Promise<UnresolvedOwner[]> {
        const owners = await this.prisma.unresolvedOwner.findMany({
            where: { insightVersionId },
        });

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async findByPluginName(pluginName: string): Promise<UnresolvedOwner[]> {
        const owners = await this.prisma.unresolvedOwner.findMany({
            where: { pluginName },
        });

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async findAllWithUsername(): Promise<UnresolvedOwner[]> {
        const owners = await this.prisma.unresolvedOwner.findMany({
            where: { platformUsername: { not: null } },
        });

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async findByPlatformUserId(
        platformUserId: string,
        pluginName: string,
    ): Promise<UnresolvedOwner[]> {
        const owners = await this.prisma.unresolvedOwner.findMany({
            where: { platformUserId, pluginName },
        });

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async findByPlatformUsername(
        platformUsername: string,
        pluginName: string,
    ): Promise<UnresolvedOwner[]> {
        const owners = await this.prisma.unresolvedOwner.findMany({
            where: { platformUsername, pluginName },
        });

        return owners.map((o) => this.toUnresolvedOwner(o));
    }

    async deleteByInsightVersionId(insightVersionId: string): Promise<void> {
        await this.prisma.unresolvedOwner.deleteMany({
            where: { insightVersionId },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.unresolvedOwner.delete({
            where: { id },
        });
    }

    async deleteMany(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.prisma.unresolvedOwner.deleteMany({
            where: { id: { in: ids } },
        });
    }

    private toUnresolvedOwner(row: {
        id: string;
        platformUserId: string | null;
        platformUsername: string | null;
        pluginName: string;
        insightVersionId: string;
        createdAt: Date;
    }): UnresolvedOwner {
        return {
            id: row.id,
            platformUserId: row.platformUserId,
            platformUsername: row.platformUsername,
            pluginName: row.pluginName,
            insightVersionId: row.insightVersionId,
            createdAt: row.createdAt,
        };
    }
}
