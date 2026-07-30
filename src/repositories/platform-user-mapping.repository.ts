import { Injectable, Logger } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

export interface PlatformUserMapping {
    id: string;
    platformUserId: string;
    appUserId: string;
    pluginName: string;
    platformUsername: string;
}

export interface PlatformUserMappingWithUser extends PlatformUserMapping {
    user: {
        firstName: string;
        lastName: string | null;
    };
}

@Injectable()
export class PlatformUserMappingRepository {
    private readonly logger = new Logger(PlatformUserMappingRepository.name);

    constructor(private readonly prisma: AppDbService) {}

    async create(data: {
        platformUserId: string;
        appUserId: string;
        pluginName: string;
        platformUsername: string;
    }): Promise<PlatformUserMapping> {
        const mapping = await this.prisma.platformUserMapping.create({
            data: {
                platformUserId: data.platformUserId,
                appUserId: data.appUserId,
                pluginName: data.pluginName,
                platformUsername: data.platformUsername,
            },
        });

        await this.resolveUnresolvedOwners(
            data.platformUserId,
            data.platformUsername,
            data.pluginName,
            data.appUserId,
        );

        return this.toMapping(mapping);
    }

    async findByPlatformUser(
        platformUserId: string,
        pluginName: string,
    ): Promise<PlatformUserMapping | null> {
        const mapping = await this.prisma.platformUserMapping.findUnique({
            where: {
                platformUserId_pluginName: {
                    platformUserId,
                    pluginName,
                },
            },
        });

        return mapping ? this.toMapping(mapping) : null;
    }

    async findByAppUser(appUserId: string): Promise<PlatformUserMapping[]> {
        const mappings = await this.prisma.platformUserMapping.findMany({
            where: { appUserId },
        });

        return mappings.map((m) => this.toMapping(m));
    }

    async findByPluginName(pluginName: string): Promise<PlatformUserMapping[]> {
        const mappings = await this.prisma.platformUserMapping.findMany({
            where: { pluginName },
        });

        return mappings.map((m) => this.toMapping(m));
    }

    async findWithUser(
        pluginName: string,
    ): Promise<PlatformUserMappingWithUser[]> {
        const mappings = await this.prisma.platformUserMapping.findMany({
            where: { pluginName },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return mappings.map((m) => ({
            ...this.toMapping(m),
            user: m.user,
        }));
    }

    async upsert(data: {
        platformUserId: string;
        appUserId: string;
        pluginName: string;
        platformUsername: string;
    }): Promise<PlatformUserMapping> {
        const mapping = await this.prisma.platformUserMapping.upsert({
            where: {
                platformUserId_pluginName: {
                    platformUserId: data.platformUserId,
                    pluginName: data.pluginName,
                },
            },
            create: {
                platformUserId: data.platformUserId,
                appUserId: data.appUserId,
                pluginName: data.pluginName,
                platformUsername: data.platformUsername,
            },
            update: {
                appUserId: data.appUserId,
                platformUsername: data.platformUsername,
            },
        });

        await this.resolveUnresolvedOwners(
            data.platformUserId,
            data.platformUsername,
            data.pluginName,
            data.appUserId,
        );

        return this.toMapping(mapping);
    }

    async delete(platformUserId: string, pluginName: string): Promise<void> {
        await this.prisma.platformUserMapping.delete({
            where: {
                platformUserId_pluginName: {
                    platformUserId,
                    pluginName,
                },
            },
        });
    }

    private async resolveUnresolvedOwners(
        platformUserId: string,
        platformUsername: string,
        pluginName: string,
        appUserId: string,
    ): Promise<void> {
        const unresolved = await this.prisma.unresolvedOwner.findMany({
            where: {
                pluginName,
                OR: [{ platformUserId }, { platformUsername }],
            },
        });

        if (unresolved.length === 0) return;

        const existing = await this.prisma.insightVersionOwner.findMany({
            where: {
                userId: appUserId,
                insightVersionId: {
                    in: unresolved.map((u) => u.insightVersionId),
                },
            },
            select: { insightVersionId: true },
        });

        const existingIds = new Set(existing.map((e) => e.insightVersionId));
        const toCreate = unresolved.filter(
            (u) => !existingIds.has(u.insightVersionId),
        );

        if (toCreate.length > 0) {
            await this.prisma.insightVersionOwner.createMany({
                data: toCreate.map((u) => ({
                    userId: appUserId,
                    insightVersionId: u.insightVersionId,
                    status: 'PENDING' as const,
                })),
            });
        }

        await this.prisma.unresolvedOwner.deleteMany({
            where: { id: { in: unresolved.map((u) => u.id) } },
        });

        this.logger.log(
            `Resolved ${unresolved.length} unresolved owner(s) via mapping (platformUserId=${platformUserId})`,
        );
    }

    private toMapping(row: {
        id: string;
        platformUserId: string;
        appUserId: string;
        pluginName: string;
        platformUsername: string;
    }): PlatformUserMapping {
        return {
            id: row.id,
            platformUserId: row.platformUserId,
            appUserId: row.appUserId,
            pluginName: row.pluginName,
            platformUsername: row.platformUsername,
        };
    }
}
