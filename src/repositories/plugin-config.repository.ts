import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Prisma } from 'generated/app-db-client';

export interface PluginConfigData {
    id: string;
    organizationId: string | null;
    userId: string;
    pluginName: string;
    config: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class PluginConfigRepository {
    constructor(private readonly prisma: AppDbService) {}

    async findUnique(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData | null> {
        const row = await this.prisma.pluginConfig.findUnique({
            where: { userId_pluginName: { userId, pluginName } },
        });
        return row ? this.toData(row) : null;
    }

    async findUniqueOrThrow(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.findUniqueOrThrow({
            where: { userId_pluginName: { userId, pluginName } },
        });
        return this.toData(row);
    }

    async findMany(filter?: {
        organizationId?: string;
        pluginName?: string;
    }): Promise<PluginConfigData[]> {
        const where: Record<string, unknown> = {};
        if (filter?.organizationId) where.organizationId = filter.organizationId;
        if (filter?.pluginName) where.pluginName = filter.pluginName;

        const rows = await this.prisma.pluginConfig.findMany({ where });
        return rows.map((r) => this.toData(r));
    }

    async create(data: {
        userId: string;
        pluginName: string;
        organizationId?: string;
        config: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.create({
            data: {
                userId: data.userId,
                pluginName: data.pluginName,
                organizationId: data.organizationId ?? null,
                config: toJson(data.config),
                metadata: data.metadata ? toJson(data.metadata) : Prisma.JsonNull,
            },
        });
        return this.toData(row);
    }

    async update(
        userId: string,
        pluginName: string,
        data: {
            config?: Record<string, unknown>;
            metadata?: Record<string, unknown>;
            organizationId?: string;
        },
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.update({
            where: { userId_pluginName: { userId, pluginName } },
            data: {
                ...(data.config !== undefined && { config: toJson(data.config) }),
                ...(data.metadata !== undefined && {
                    metadata: data.metadata ? toJson(data.metadata) : Prisma.JsonNull,
                }),
                ...(data.organizationId !== undefined && {
                    organizationId: data.organizationId,
                }),
            },
        });
        return this.toData(row);
    }

    async upsert(data: {
        userId: string;
        pluginName: string;
        organizationId?: string;
        config: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.upsert({
            where: { userId_pluginName: { userId: data.userId, pluginName: data.pluginName } },
            create: {
                userId: data.userId,
                pluginName: data.pluginName,
                organizationId: data.organizationId ?? null,
                config: toJson(data.config),
                metadata: data.metadata ? toJson(data.metadata) : Prisma.JsonNull,
            },
            update: {
                config: toJson(data.config),
                ...(data.metadata !== undefined && {
                    metadata: data.metadata ? toJson(data.metadata) : Prisma.JsonNull,
                }),
                ...(data.organizationId !== undefined && {
                    organizationId: data.organizationId,
                }),
            },
        });
        return this.toData(row);
    }

    async remove(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.delete({
            where: { userId_pluginName: { userId, pluginName } },
        });
        return this.toData(row);
    }

    private toData(row: {
        id: string;
        organizationId: string | null;
        userId: string;
        pluginName: string;
        config: unknown;
        metadata: unknown;
        createdAt: Date;
        updatedAt: Date;
    }): PluginConfigData {
        return {
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            pluginName: row.pluginName,
            config: (typeof row.config === 'object' && row.config !== null
                ? row.config
                : {}) as Record<string, unknown>,
            metadata: (typeof row.metadata === 'object' && row.metadata !== null
                ? row.metadata
                : null) as Record<string, unknown> | null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}

function toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value));
}
