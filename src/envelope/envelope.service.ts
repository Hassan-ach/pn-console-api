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
}

@Injectable()
export class EnvelopeService {
    constructor(private readonly prisma: RawDbService) {}

    async bulkCreate(
        items: CreateEnvelopeDto[],
        options?: { organizationId?: string },
    ): Promise<BulkCreateResult> {
        if (items.length === 0) return { inserted: 0 };

        let totalInserted = 0;

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            totalInserted += await this.insertChunk(chunk, options?.organizationId);
        }

        return { inserted: totalInserted };
    }

    private async insertChunk(
        items: CreateEnvelopeDto[],
        organizationId?: string,
    ): Promise<number> {
        let inserted = 0;

        await this.prisma.$transaction(async (tx) => {
            for (const item of items) {
                try {
                    const payload = await tx.messagePayload.create({
                        data: {
                            type: item.payload.type,
                            content: item.payload.content,
                            groupId: item.payload.group_id,
                            channelId: item.payload.channel_id,
                            replyTo: item.payload.reply_to,
                            reactions: item.payload.reactions
                                ? toJson(item.payload.reactions)
                                : Prisma.JsonNull,
                            pinned: item.payload.pinned,
                            editedDate: item.payload.edited_date
                                ? new Date(item.payload.edited_date)
                                : null,
                            entities: item.payload.entities
                                ? toJson(item.payload.entities)
                                : Prisma.JsonNull,
                            rawPayload: item.payload.raw_payload
                                ? toJson(item.payload.raw_payload)
                                : Prisma.JsonNull,
                        },
                    });

                    await tx.envelope.create({
                        data: {
                            sourcePlugin: item.envelope.source_plugin,
                            sourceId: item.envelope.source_id,
                            type: item.envelope.type,
                            payloadRef: payload.id,
                            hasAttachment: item.envelope.has_attachment,
                            authorId: item.envelope.author_id,
                            organizationId:
                                item.envelope.organization_id ??
                                organizationId ??
                                null,
                            status: this.parseStatus(item.envelope.status),
                            permissions: item.envelope.permissions
                                ? toJson(item.envelope.permissions)
                                : Prisma.JsonNull,
                            occurredAt: new Date(item.envelope.occurred_at),
                        },
                    });

                    inserted++;
                } catch (error) {
                    if (
                        error instanceof Prisma.PrismaClientKnownRequestError &&
                        error.code === 'P2002'
                    ) {
                        continue;
                    }
                    throw error;
                }
            }
        });

        return inserted;
    }

    private parseStatus(
        status: string | undefined,
    ): 'PENDING' | 'READY' | 'FAILED' {
        if (
            status === 'PENDING' ||
            status === 'READY' ||
            status === 'FAILED'
        ) {
            return status;
        }
        return 'PENDING';
    }

    async findAll(query: EnvelopeQueryDto) {
        const where: Record<string, unknown> = {};

        if (query.source_plugin) where.sourcePlugin = query.source_plugin;
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

    async count(source_plugin?: string) {
        const where: Record<string, unknown> = {};
        if (source_plugin) where.sourcePlugin = source_plugin;
        return this.prisma.envelope.count({ where });
    }
}
