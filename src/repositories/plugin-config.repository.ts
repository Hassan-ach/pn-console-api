import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
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
        userId?: string;
        organizationId?: string;
        pluginName?: string;
    }): Promise<PluginConfigData[]> {
        const where: Record<string, unknown> = {};
        if (filter?.userId) where.userId = filter.userId;
        if (filter?.organizationId)
            where.organizationId = filter.organizationId;
        if (filter?.pluginName) where.pluginName = filter.pluginName;

        const rows = await this.prisma.pluginConfig.findMany({ where });
        return rows.map((r) => this.toData(r));
    }

    async create(
        userId: string,
        pluginName: string,
        data: {
            organizationId: string;
            config: Record<string, unknown>;
            metadata?: Record<string, unknown>;
        },
    ): Promise<PluginConfigData> {
        try {
            const row = await this.prisma.pluginConfig.create({
                data: {
                    userId: userId,
                    pluginName: pluginName,
                    organizationId: data.organizationId ?? null,
                    config: toJson(data.config),
                    metadata: data.metadata
                        ? toJson(data.metadata)
                        : Prisma.JsonNull,
                },
            });
            return this.toData(row);
        } catch (err) {
            if (
                typeof err === 'object' &&
                err !== null &&
                (err as Record<string, unknown>).code === 'P2002'
            ) {
                throw new ConflictException(
                    `Configuration already exists for this plugin`,
                );
            }
            throw err;
        }
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
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.pluginConfig.findUnique({
                where: {
                    userId_pluginName: { userId, pluginName },
                },
            });

            if (!current) {
                throw new NotFoundException(
                    `Configuration not found for this plugin`,
                );
            }

            const row = await tx.pluginConfig.update({
                where: {
                    userId_pluginName: { userId, pluginName },
                },
                data: {
                    ...(data.config !== undefined && {
                        config: toJson({
                            ...(current.config as Record<string, unknown>),
                            ...data.config,
                        }),
                    }),
                    ...(data.metadata !== undefined && {
                        metadata: data.metadata
                            ? toJson({
                                  ...((current.metadata as Record<
                                      string,
                                      unknown
                                  >) ?? {}),
                                  ...data.metadata,
                              })
                            : Prisma.JsonNull,
                    }),
                    ...(data.organizationId !== undefined && {
                        organizationId: data.organizationId,
                    }),
                },
            });

            return this.toData(row);
        });
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
