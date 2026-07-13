import { Injectable } from '@nestjs/common';
import { RawDbService } from '../prisma/raw-db/raw-db.service';
import { Prisma } from 'generated/raw-db-client';
import type { CreateEnvelopeDto } from './dto/create-envelope.dto';
import type { EnvelopeQueryDto } from './dto/envelope-query.dto';

const CHUNK_SIZE = 500;

function toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value));
}

export interface BulkCreateResult {
    inserted: number;
    ids: string[];
}

@Injectable()
export class EnvelopeService {
    constructor(private readonly prisma: RawDbService) {}

    async bulkCreate(
        items: CreateEnvelopeDto[],
        options: { organizationId: string },
    ): Promise<BulkCreateResult> {
        if (items.length === 0) return { inserted: 0, ids: [] };

        let totalInserted = 0;
        const allIds: string[] = [];

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const { inserted, ids } = await this.insertChunk(
                chunk,
                options.organizationId,
            );
            totalInserted += inserted;
            allIds.push(...ids);
        }

        return { inserted: totalInserted, ids: allIds };
    }

    private async insertChunk(
        items: CreateEnvelopeDto[],
        organizationId: string,
    ): Promise<{ inserted: number; ids: string[] }> {
        const ids: string[] = [];

        await this.prisma.$transaction(async (tx) => {
            for (const item of items) {
                const exists = await tx.envelope.findUnique({
                    where: {
                        sourcePlugin_sourceId: {
                            sourcePlugin: item.envelope.sourcePlugin,
                            sourceId: item.envelope.sourceId,
                        },
                    },
                    select: { id: true },
                });
                if (exists) continue;

                const payload = await tx.messagePayload.create({
                    data: {
                        type: item.payload.type,
                        content: item.payload.content,
                        groupId: item.payload.groupId,
                        channelId: item.payload.channelId,
                        replyTo: item.payload.replyTo,
                        topicId: item.payload.topicId,
                        reactions: item.payload.reactions
                            ? toJson(item.payload.reactions)
                            : Prisma.JsonNull,
                        pinned: item.payload.pinned,
                        editedDate: item.payload.editedDate,
                        entities: item.payload.entities
                            ? toJson(item.payload.entities)
                            : Prisma.JsonNull,
                        rawPayload: item.payload.rawPayload
                            ? toJson(item.payload.rawPayload)
                            : Prisma.JsonNull,
                    },
                });

                const envelope = await tx.envelope.create({
                    data: {
                        sourcePlugin: item.envelope.sourcePlugin,
                        sourceId: item.envelope.sourceId,
                        type: item.envelope.type,
                        payloadRef: payload.id,
                        hasAttachment: item.envelope.hasAttachment,
                        authorId: item.envelope.authorId,
                        organizationId:
                            item.envelope.organizationId ?? organizationId,
                        status: this.parseStatus(item.envelope.status),
                        permissions: item.envelope.permissions
                            ? toJson(item.envelope.permissions)
                            : Prisma.JsonNull,
                        occurredAt: item.envelope.occurredAt,
                    },
                });

                ids.push(envelope.id);
            }
        });

        return { inserted: ids.length, ids };
    }

    private parseStatus(
        status: string | undefined,
    ): 'PENDING' | 'READY' | 'FAILED' {
        if (status === 'PENDING' || status === 'READY' || status === 'FAILED') {
            return status;
        }
        return 'PENDING';
    }

    async findAll(query: EnvelopeQueryDto) {
        const where: Record<string, unknown> = {};

        if (query.sourcePlugin) where.sourcePlugin = query.sourcePlugin;
        if (query.status) where.status = query.status;

        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.prisma.envelope.findMany({
                where,
                include: { payload: true },
                skip,
                take: limit,
                orderBy: { occurredAt: 'desc' },
            }),
            this.prisma.envelope.count({ where }),
        ]);

        return { items, total, page: query.page, limit: query.limit };
    }

    async findOne(id: string) {
        return this.prisma.envelope.findUnique({
            where: { id },
            include: { payload: true },
        });
    }

    async count(sourcePlugin?: string) {
        const where: Record<string, unknown> = {};
        if (sourcePlugin) where.sourcePlugin = sourcePlugin;
        return this.prisma.envelope.count({ where });
    }
}
