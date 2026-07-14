import { Injectable } from '@nestjs/common';
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

    async findByPluginName(
        pluginName: string,
    ): Promise<PlatformUserMapping[]> {
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

    async delete(
        platformUserId: string,
        pluginName: string,
    ): Promise<void> {
        await this.prisma.platformUserMapping.delete({
            where: {
                platformUserId_pluginName: {
                    platformUserId,
                    pluginName,
                },
            },
        });
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
