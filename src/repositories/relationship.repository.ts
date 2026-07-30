import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Prisma, Entity, Relationship } from 'generated/app-db-client';

export interface CreateRelationshipInput {
    organizationId?: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    metadata?: Record<string, any>;
}

export interface GraphNeighborhood {
    rootEntity: Entity;
    entities: Entity[];
    relationships: Relationship[];
}

@Injectable()
export class RelationshipRepository {
    constructor(private readonly prisma: AppDbService) {}

    async create(data: CreateRelationshipInput) {
        return this.prisma.relationship.create({
            data: {
                organizationId: data.organizationId ?? null,
                sourceEntityId: data.sourceEntityId,
                targetEntityId: data.targetEntityId,
                type: data.type.trim(),
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
        });
    }

    async upsert(data: CreateRelationshipInput) {
        const normalizedType = data.type.trim();

        return this.prisma.relationship.upsert({
            where: {
                sourceEntityId_targetEntityId_type: {
                    sourceEntityId: data.sourceEntityId,
                    targetEntityId: data.targetEntityId,
                    type: normalizedType,
                },
            },
            create: {
                organizationId: data.organizationId ?? null,
                sourceEntityId: data.sourceEntityId,
                targetEntityId: data.targetEntityId,
                type: normalizedType,
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
            update: {
                metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
            },
        });
    }

    async findById(id: string) {
        return this.prisma.relationship.findUnique({
            where: { id },
            include: {
                sourceEntity: true,
                targetEntity: true,
            },
        });
    }

    async findBySourceOrTarget(entityId: string) {
        return this.prisma.relationship.findMany({
            where: {
                OR: [
                    { sourceEntityId: entityId },
                    { targetEntityId: entityId },
                ],
            },
            include: {
                sourceEntity: true,
                targetEntity: true,
            },
        });
    }

    async getNeighbors(
        entityId: string,
        maxDepth = 2,
    ): Promise<GraphNeighborhood | null> {
        const rootEntity = await this.prisma.entity.findUnique({
            where: { id: entityId },
        });

        if (!rootEntity) {
            return null;
        }

        const visitedEntityIds = new Set<string>([entityId]);
        const visitedRelationshipIds = new Set<string>();
        const entitiesMap = new Map<string, Entity>([[entityId, rootEntity]]);
        const relationshipsMap = new Map<string, Relationship>();

        let currentLayerIds = [entityId];

        for (let depth = 0; depth < maxDepth; depth++) {
            if (currentLayerIds.length === 0) break;

            const relationships = await this.prisma.relationship.findMany({
                where: {
                    OR: [
                        { sourceEntityId: { in: currentLayerIds } },
                        { targetEntityId: { in: currentLayerIds } },
                    ],
                },
                include: {
                    sourceEntity: true,
                    targetEntity: true,
                },
            });

            const nextLayerIds: string[] = [];

            for (const rel of relationships) {
                relationshipsMap.set(rel.id, rel);
                visitedRelationshipIds.add(rel.id);

                if (!visitedEntityIds.has(rel.sourceEntity.id)) {
                    visitedEntityIds.add(rel.sourceEntity.id);
                    entitiesMap.set(rel.sourceEntity.id, rel.sourceEntity);
                    nextLayerIds.push(rel.sourceEntity.id);
                }

                if (!visitedEntityIds.has(rel.targetEntity.id)) {
                    visitedEntityIds.add(rel.targetEntity.id);
                    entitiesMap.set(rel.targetEntity.id, rel.targetEntity);
                    nextLayerIds.push(rel.targetEntity.id);
                }
            }

            currentLayerIds = nextLayerIds;
        }

        return {
            rootEntity,
            entities: Array.from(entitiesMap.values()),
            relationships: Array.from(relationshipsMap.values()),
        };
    }

    async delete(id: string) {
        return this.prisma.relationship.delete({
            where: { id },
        });
    }
}
