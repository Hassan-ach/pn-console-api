import {
    Injectable,
    Inject,
    Optional,
    NotFoundException,
} from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Prisma, PluginStatus } from 'generated/app-db-client';
import { CACHE_STORE_TOKEN } from 'src/common/providers/cache-store/cache-store.interface';
import type { ICacheStore } from 'src/common/providers/cache-store/cache-store.interface';

export interface PluginConfigData {
    id: string;
    organizationId: string | null;
    userId: string;
    pluginName: string;
    sessionString: string | null;
    config: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    status: PluginStatus;
    activatedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class PluginConfigRepository {
    private readonly DEFAULT_TTL_MS = 60000; // 60s TTL

    constructor(
        private readonly prisma: AppDbService,
        @Optional()
        @Inject(CACHE_STORE_TOKEN)
        private readonly cacheStore?: ICacheStore,
    ) {}

    private getCacheKey(userId: string, pluginName: string): string {
        return `plugin_config:${userId}:${pluginName}`;
    }

    private async invalidateCache(
        userId: string,
        pluginName: string,
    ): Promise<void> {
        if (this.cacheStore) {
            try {
                await this.cacheStore.delete(
                    this.getCacheKey(userId, pluginName),
                );
            } catch {
                // Non-fatal cache deletion error
            }
        }
    }

    async findUnique(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData | null> {
        const cacheKey = this.getCacheKey(userId, pluginName);
        if (this.cacheStore) {
            try {
                const cached =
                    await this.cacheStore.get<PluginConfigData>(cacheKey);
                if (cached) {
                    return this.rehydrateDates(cached);
                }
            } catch {
                // Non-fatal cache read error; fall back to DB
            }
        }

        const row = await this.prisma.pluginConfig.findUnique({
            where: { userId_pluginName: { userId, pluginName } },
        });
        const data = row ? this.toData(row) : null;

        if (data && this.cacheStore) {
            try {
                await this.cacheStore.set(cacheKey, data, this.DEFAULT_TTL_MS);
            } catch {
                // Non-fatal cache write error
            }
        }

        return data;
    }

    async findUniqueOrThrow(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData> {
        const result = await this.findUnique(userId, pluginName);
        if (!result) {
            throw new NotFoundException(
                `Configuration not found for plugin ${pluginName}`,
            );
        }
        return result;
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

    async upsert(
        userId: string,
        pluginName: string,
        data: {
            organizationId: string;
            config: Record<string, unknown>;
            metadata?: Record<string, unknown>;
        },
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.upsert({
            where: { userId_pluginName: { userId, pluginName } },
            create: {
                userId,
                pluginName,
                organizationId: data.organizationId ?? null,
                config: toJson(data.config),
                metadata: data.metadata
                    ? toJson(data.metadata)
                    : Prisma.JsonNull,
            },
            update: {
                config: toJson(data.config),
                ...(data.metadata !== undefined && {
                    metadata: data.metadata
                        ? toJson(data.metadata)
                        : Prisma.JsonNull,
                }),
            },
        });
        await this.invalidateCache(userId, pluginName);
        return this.toData(row);
    }

    async update(
        userId: string,
        pluginName: string,
        data: {
            config?: Record<string, unknown>;
            metadata?: Record<string, unknown>;
            organizationId?: string;
            sessionString?: string | null;
            status?: PluginStatus;
            activatedAt?: Date | null;
            errorMessage?: string | null;
        },
    ): Promise<PluginConfigData> {
        const result = await this.prisma.$transaction(async (tx) => {
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
                    ...(data.sessionString !== undefined && {
                        sessionString: data.sessionString,
                    }),
                    ...(data.status !== undefined && {
                        status: data.status,
                    }),
                    ...(data.activatedAt !== undefined && {
                        activatedAt: data.activatedAt,
                    }),
                    ...(data.errorMessage !== undefined && {
                        errorMessage: data.errorMessage,
                    }),
                },
            });

            return this.toData(row);
        });

        await this.invalidateCache(userId, pluginName);
        return result;
    }

    async updateSessionString(
        userId: string,
        pluginName: string,
        sessionString: string,
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.update({
            where: { userId_pluginName: { userId, pluginName } },
            data: { sessionString },
        });
        await this.invalidateCache(userId, pluginName);
        return this.toData(row);
    }

    async clearSessionString(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.update({
            where: { userId_pluginName: { userId, pluginName } },
            data: { sessionString: null },
        });
        await this.invalidateCache(userId, pluginName);
        return this.toData(row);
    }

    async remove(
        userId: string,
        pluginName: string,
    ): Promise<PluginConfigData> {
        const row = await this.prisma.pluginConfig.delete({
            where: { userId_pluginName: { userId, pluginName } },
        });
        await this.invalidateCache(userId, pluginName);
        return this.toData(row);
    }

    private toData(row: {
        id: string;
        organizationId: string | null;
        userId: string;
        pluginName: string;
        sessionString: string | null;
        config: unknown;
        metadata: unknown;
        status: PluginStatus;
        activatedAt: Date | null;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }): PluginConfigData {
        return {
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            pluginName: row.pluginName,
            sessionString: row.sessionString,
            config: (typeof row.config === 'object' && row.config !== null
                ? row.config
                : {}) as Record<string, unknown>,
            metadata: (typeof row.metadata === 'object' && row.metadata !== null
                ? row.metadata
                : null) as Record<string, unknown> | null,
            status: row.status,
            activatedAt: row.activatedAt,
            errorMessage: row.errorMessage,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    private rehydrateDates(data: PluginConfigData): PluginConfigData {
        return {
            ...data,
            activatedAt: data.activatedAt ? new Date(data.activatedAt) : null,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
        };
    }
}

function toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
