import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Prisma } from 'generated/app-db-client';

export interface CreateEntityInput {
    organizationId?: string;
    name: string;
    type: string;
    metadata?: Record<string, any>;
}

export interface UpdateEntityInput {
    name?: string;
    type?: string;
    metadata?: Record<string, any>;
}

const UUID_REGEX =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isUuid(id: string): boolean {
    return UUID_REGEX.test(id);
}

@Injectable()
export class EntityRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: CreateEntityInput) {
        return this.prisma.entity.create({
            data: {
                organizationId: data.organizationId ?? null,
                name: data.name.trim(),
                type: data.type.trim(),
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
        });
    }

    async upsert(data: CreateEntityInput) {
        const normalizedName = data.name.trim();
        const normalizedType = data.type.trim();

        const existing = await this.prisma.entity.findFirst({
            where: {
                organizationId: data.organizationId ?? null,
                name: {
                    equals: normalizedName,
                    mode: 'insensitive',
                },
                type: {
                    equals: normalizedType,
                    mode: 'insensitive',
                },
            },
        });

        if (existing) {
            const mergedMetadata = {
                ...((existing.metadata as Record<string, any>) || {}),
                ...(data.metadata || {}),
            };
            return this.prisma.entity.update({
                where: { id: existing.id },
                data: {
                    metadata: mergedMetadata,
                },
            });
        }

        return this.prisma.entity.create({
            data: {
                organizationId: data.organizationId ?? null,
                name: normalizedName,
                type: normalizedType,
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
        });
    }

    async findById(id: string) {
        if (!isUuid(id)) return null;
        return this.prisma.entity.findUnique({
            where: { id },
        });
    }

    async findByNameAndType(
        organizationId: string | undefined,
        name: string,
        type: string,
    ) {
        return this.prisma.entity.findFirst({
            where: {
                organizationId: organizationId ?? null,
                name: {
                    equals: name.trim(),
                    mode: 'insensitive',
                },
                type: {
                    equals: type.trim(),
                    mode: 'insensitive',
                },
            },
        });
    }

    async search(
        organizationId: string | undefined,
        query: string,
        type?: string,
        limit = 20,
    ) {
        const where: Prisma.EntityWhereInput = {
            ...(organizationId ? { organizationId } : {}),
            ...(type
                ? { type: { equals: type.trim(), mode: 'insensitive' } }
                : {}),
            name: {
                contains: query.trim(),
                mode: 'insensitive',
            },
        };

        return this.prisma.entity.findMany({
            where,
            take: limit,
            orderBy: { name: 'asc' },
        });
    }

    async update(id: string, data: UpdateEntityInput) {
        if (!isUuid(id)) return null;
        const updateData: Prisma.EntityUpdateInput = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.type !== undefined) updateData.type = data.type.trim();
        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata as Prisma.InputJsonValue;
        }

        return this.prisma.entity.update({
            where: { id },
            data: updateData,
        });
    }

    async delete(id: string) {
        if (!isUuid(id)) return null;
        return this.prisma.entity.delete({
            where: { id },
        });
    }
}
