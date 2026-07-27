import { Injectable } from '@nestjs/common';
import { RawDbService } from '../prisma/raw-db/raw-db.service';
import { Prisma } from 'generated/raw-db-client';

function toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseStatus(status: string): 'PENDING' | 'READY' | 'FAILED' {
    if (status === 'PENDING' || status === 'READY' || status === 'FAILED') {
        return status;
    }
    return 'PENDING';
}

export interface CreateEnvelopeInput {
    envelope: {
        sourcePlugin: string;
        sourceId: string;
        type: string;
        hasAttachment: boolean;
        authorId: string | null;
        organizationId: string;
        status: string;
        permissions?: Record<string, unknown>;
        occurredAt: Date;
    };
    payload: {
        type: string;
        content: string;
        groupId: string | null;
        channelId: string | null;
        replyTo: string | null;
        topicId: string | null;
        reactions?: Record<string, unknown>;
        pinned: boolean;
        editedDate: Date | null;
        entities?: Record<string, unknown> | null;
        rawPayload: Record<string, unknown>;
    };
}

export interface CreateManyResult {
    inserted: number;
    ids: string[];
}

@Injectable()
export class EnvelopeRepository {
    constructor(private readonly rawDb: RawDbService) {}

    async createManyWithPayload(
        items: CreateEnvelopeInput[],
    ): Promise<CreateManyResult> {
        if (items.length === 0) {
            return { inserted: 0, ids: [] };
        }

        const uniqueItems = new Map<string, CreateEnvelopeInput>();

        for (const item of items) {
            const key = `${item.envelope.sourcePlugin}:${item.envelope.sourceId}`;
            uniqueItems.set(key, item);
        }

        const dedupedItems = [...uniqueItems.values()];

        const existing = await this.rawDb.envelope.findMany({
            where: {
                OR: dedupedItems.map((item) => ({
                    sourcePlugin: item.envelope.sourcePlugin,
                    sourceId: item.envelope.sourceId,
                })),
            },
            select: {
                sourcePlugin: true,
                sourceId: true,
            },
        });

        const existingKeys = new Set(
            existing.map((e) => `${e.sourcePlugin}:${e.sourceId}`),
        );

        const ids: string[] = [];

        await this.rawDb.$transaction(async (tx) => {
            for (const item of dedupedItems) {
                const key = `${item.envelope.sourcePlugin}:${item.envelope.sourceId}`;

                if (existingKeys.has(key)) {
                    continue;
                }

                const payload = await tx.messagePayload.create({
                    data: {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        type: item.payload.type as any,
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        type: item.envelope.type as any,
                        payloadRef: payload.id,
                        hasAttachment: item.envelope.hasAttachment,
                        authorId: item.envelope.authorId,
                        organizationId: item.envelope.organizationId,
                        status: parseStatus(item.envelope.status),
                        permissions: item.envelope.permissions
                            ? toJson(item.envelope.permissions)
                            : Prisma.JsonNull,
                        occurredAt: item.envelope.occurredAt,
                    },
                });

                ids.push(envelope.id);
            }
        });

        return {
            inserted: ids.length,
            ids,
        };
    }

    async markStatus(
        ids: string[],
        status: 'READY' | 'FAILED',
    ): Promise<number> {
        if (ids.length === 0) return 0;
        const result = await this.rawDb.envelope.updateMany({
            where: { id: { in: ids } },
            data: { status },
        });
        return result.count;
    }

    async findByIds(ids: string[]): Promise<
        {
            envolopId: string;
            sourcePlugin: string;
            occurredAt: Date;
            content: string;
        }[]
    > {
        if (ids.length === 0) return [];

        const envelopes = await this.rawDb.envelope.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                sourcePlugin: true,
                occurredAt: true,
                payload: {
                    select: { content: true },
                },
            },
        });

        return envelopes.map((e) => ({
            envolopId: e.id,
            sourcePlugin: e.sourcePlugin,
            occurredAt: e.occurredAt,
            content: e.payload.content,
        }));
    }

    async findRecent(limit: number): Promise<
        {
            envolopId: string;
            sourcePlugin: string;
            occurredAt: Date;
            content: string;
        }[]
    > {
        if (limit <= 0) return [];

        const envelopes = await this.rawDb.envelope.findMany({
            orderBy: { occurredAt: 'desc' },
            take: limit,
            select: {
                id: true,
                sourcePlugin: true,
                occurredAt: true,
                payload: {
                    select: { content: true },
                },
            },
        });

        return envelopes.map((e) => ({
            envolopId: e.id,
            sourcePlugin: e.sourcePlugin,
            occurredAt: e.occurredAt,
            content: e.payload.content,
        }));
    }

    async count(sourcePlugin?: string): Promise<number> {
        const where: Record<string, unknown> = {};
        if (sourcePlugin) where.sourcePlugin = sourcePlugin;
        return this.rawDb.envelope.count({ where });
    }
}
