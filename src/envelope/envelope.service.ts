import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { CreateEnvelopeDto } from './dto/create-envelope.dto';
import type { EnvelopeQueryDto } from './dto/envelope-query.dto';

function toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value));
}

export interface BulkCreateResult {
    inserted: number;
}

@Injectable()
export class EnvelopeService {
    constructor(private readonly prisma: PrismaService) {}

    async bulkCreate(items: CreateEnvelopeDto[]): Promise<BulkCreateResult> {
        let inserted = 0;

        for (const item of items) {
            const existing = await this.prisma.envelope.findUnique({
                where: {
                    sourcePlugin_sourceId: {
                        sourcePlugin: item.envelope.source_plugin,
                        sourceId: item.envelope.source_id,
                    },
                },
                select: { id: true },
            });

            if (existing) continue;

            const payload = await this.prisma.messagePayload.create({
                data: {
                    type: item.payload.type,
                    content: item.payload.content,
                    groupId: item.payload.group_id,
                    replyTo: item.payload.reply_to,
                    reactions: toJson(item.payload.reactions),
                    pinned: item.payload.pinned,
                    editedDate: item.payload.edited_date
                        ? new Date(item.payload.edited_date)
                        : null,
                    entities: item.payload.entities
                        ? toJson(item.payload.entities)
                        : Prisma.DbNull,
                    rawPayload: toJson(item.payload.raw_payload),
                },
            });

            await this.prisma.envelope.create({
                data: {
                    sourcePlugin: item.envelope.source_plugin,
                    sourceId: item.envelope.source_id,
                    type: item.envelope.type,
                    payloadRef: payload.id,
                    hasAttachment: item.envelope.has_attachment,
                    authorRef: item.envelope.author_ref,
                    occurredAt: new Date(item.envelope.occurred_at),
                },
            });

            inserted++;
        }

        return { inserted };
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
