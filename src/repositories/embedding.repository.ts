import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

export interface SimilarityResult {
    insightVersionId: string;
    insightId: string;
    content: string;
    type: string;
    status: string | null;
    priority: number | null;
    sourcePlugin: string | null;
    groupId: string | null;
    channelId: string | null;
    topicId: string | null;
    deadline: Date | null;
    createdAt: Date;
    similarity: number;
}

@Injectable()
export class EmbeddingRepository {
    constructor(private readonly prisma: AppDbService) {}

    async upsert(insightVersionId: string, embedding: number[]): Promise<void> {
        const vector = `[${embedding.join(',')}]`;
        await this.prisma.$queryRawUnsafe(
            `UPDATE "insight_versions" SET "embedding" = $1::vector WHERE "id" = $2::uuid`,
            vector,
            insightVersionId,
        );
    }

    async searchSimilar(
        embedding: number[],
        limit: number,
        userId?: string,
        minSimilarity = 0.7,
    ): Promise<SimilarityResult[]> {
        const vector = `[${embedding.join(',')}]`;

        const joinClause = userId
            ? `LEFT JOIN "insight_version_owners" ivo ON ivo."insight_version_id" = iv."id" AND ivo."user_id" = $1::uuid`
            : '';

        const ownerSelect = userId
            ? `ivo."status", ivo."priority",`
            : 'NULL::int AS "status", NULL::int AS "priority",';

        let whereClause = `iv."embedding" IS NOT NULL`;
        const params: unknown[] = [];

        if (userId) {
            params.push(userId);
            whereClause += ` AND (ivo."user_id" = $1::uuid OR iv."broadcasted" = true)`;
        }

        params.push(vector);
        const vectorIdx = params.length;

        const similarityExpr = `1 - (iv."embedding" <=> $${vectorIdx}::vector)`;

        const sql = `
            SELECT
                iv."id" AS "insightVersionId",
                iv."insightId" AS "insightId",
                iv."content",
                iv."type",
                iv."source_plugin" AS "sourcePlugin",
                iv."group_id" AS "groupId",
                iv."channel_id" AS "channelId",
                iv."topic_id" AS "topicId",
                iv."deadline" AS "deadline",
                iv."created_at" AS "createdAt",
                ${ownerSelect}
                ${similarityExpr} AS similarity
            FROM "insight_versions" iv
            ${joinClause}
            INNER JOIN (
                SELECT "insightId", MAX("version") AS "maxVersion"
                FROM "insight_versions"
                GROUP BY "insightId"
            ) latest ON iv."insightId" = latest."insightId" AND iv."version" = latest."maxVersion"
            WHERE ${whereClause}
            AND ${similarityExpr} >= $${params.length + 1}::double precision
            ORDER BY similarity DESC
            LIMIT $${params.length + 2}::int
        `;

        const allParams = [...params, minSimilarity, limit];

        const rows = await this.prisma.$queryRawUnsafe<
            Array<{
                insightVersionId: string;
                insightId: string;
                content: string;
                type: string;
                sourcePlugin: string | null;
                groupId: string | null;
                channelId: string | null;
                topicId: string | null;
                deadline: Date | null;
                createdAt: Date;
                status: string | null;
                priority: number | null;
                similarity: number;
            }>
        >(sql, ...allParams);

        return rows.map((r) => ({
            ...r,
            similarity: Number(r.similarity),
        }));
    }

    /**
     * Structured filter query — no embedding needed.
     * Returns insights matching explicit type/status filters for a user.
     * Results are marked with similarity = 1.0 (exact filter match).
     */
    async findByFilters(
        userId: string,
        limit: number,
        filters: { types?: string[]; statuses?: string[] },
    ): Promise<SimilarityResult[]> {
        const params: unknown[] = [userId];

        let typeClause = '';
        if (filters.types && filters.types.length > 0) {
            params.push(filters.types);
            typeClause = `AND iv."type"::text = ANY($${params.length}::text[])`;
        }

        let statusClause = '';
        if (filters.statuses && filters.statuses.length > 0) {
            params.push(filters.statuses);
            statusClause = `AND ivo."status"::text = ANY($${params.length}::text[])`;
        }

        params.push(limit);

        const sql = `
            SELECT
                iv."id"           AS "insightVersionId",
                iv."insightId"    AS "insightId",
                iv."content",
                iv."type",
                iv."source_plugin" AS "sourcePlugin",
                iv."group_id"     AS "groupId",
                iv."channel_id"   AS "channelId",
                iv."topic_id"     AS "topicId",
                iv."deadline"     AS "deadline",
                iv."created_at"   AS "createdAt",
                ivo."status",
                ivo."priority"
            FROM "insight_versions" iv
            LEFT JOIN "insight_version_owners" ivo
                ON ivo."insight_version_id" = iv."id"
               AND ivo."user_id" = $1::uuid
            INNER JOIN (
                SELECT "insightId", MAX("version") AS "maxVersion"
                FROM "insight_versions"
                GROUP BY "insightId"
            ) latest
                ON iv."insightId" = latest."insightId"
               AND iv."version"   = latest."maxVersion"
            WHERE (ivo."user_id" = $1::uuid OR iv."broadcasted" = true)
            ${typeClause}
            ${statusClause}
            ORDER BY ivo."priority" DESC NULLS LAST, iv."created_at" DESC
            LIMIT $${params.length}::int
        `;

        const rows = await this.prisma.$queryRawUnsafe<
            Array<{
                insightVersionId: string;
                insightId: string;
                content: string;
                type: string;
                sourcePlugin: string | null;
                groupId: string | null;
                channelId: string | null;
                topicId: string | null;
                deadline: Date | null;
                createdAt: Date;
                status: string | null;
                priority: number | null;
            }>
        >(sql, ...params);

        return rows.map((r) => ({
            ...r,
            priority: r.priority !== null ? Number(r.priority) : null,
            similarity: 1.0, // Exact filter match — not similarity-ranked
        }));
    }

    async deleteByInsightVersionId(insightVersionId: string): Promise<void> {
        await this.prisma.$queryRawUnsafe(
            `UPDATE "insight_versions" SET "embedding" = NULL WHERE "id" = $1::uuid`,
            insightVersionId,
        );
    }

    async findNullEmbeddings(limit = 50): Promise<Array<{ id: string; content: string }>> {
        return this.prisma.$queryRawUnsafe<Array<{ id: string; content: string }>>(
            `SELECT "id", "content" FROM "insight_versions" WHERE "embedding" IS NULL LIMIT $1::int`,
            limit,
        );
    }
}

