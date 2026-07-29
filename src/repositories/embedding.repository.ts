import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

export interface SimilarityResult {
    insightVersionId: string;
    insightId: string;
    content: string;
    type: string;
    status: string | null;
    priority: number | null;
    similarity: number;
}

@Injectable()
export class EmbeddingRepository {
    constructor(private readonly prisma: AppDbService) {}

    async upsert(insightVersionId: string, embedding: number[]): Promise<void> {
        const vector = `[${embedding.join(',')}]`;
        const sql = `
            UPDATE "insight_versions"
            SET "embedding" = '${vector}'::vector
            WHERE "id" = '${insightVersionId}'
        `;
        await this.prisma.$queryRawUnsafe(sql);
    }

    async searchSimilar(
        embedding: number[],
        limit: number,
        userId?: string,
        minSimilarity = 0.5,
    ): Promise<SimilarityResult[]> {
        const vector = `[${embedding.join(',')}]`;

        const joinClause = userId
            ? `
                LEFT JOIN "insight_version_owners" ivo
                    ON ivo."insight_version_id" = iv."id"
                    AND ivo."user_id" = '${userId}'
            `
            : '';

        let whereClause = `iv."embedding" IS NOT NULL`;
        if (userId) {
            whereClause += ` AND (ivo."user_id" = '${userId}' OR iv."broadcasted" = true)`;
        }

        const sql = `
            SELECT DISTINCT ON (iv."insightId")
                iv."id" AS "insightVersionId",
                iv."insightId" AS "insightId",
                iv."content",
                iv."type",
                ${userId ? 'ivo."status",' : ''}
                ${userId ? 'ivo."priority",' : ''}
                1 - (iv."embedding" <=> '${vector}'::vector) AS similarity
            FROM "insight_versions" iv
            ${joinClause}
            WHERE ${whereClause}
            AND 1 - (iv."embedding" <=> '${vector}'::vector) >= ${minSimilarity}
            ORDER BY iv."insightId", similarity DESC
            LIMIT ${limit}
        `;

        const rows = await this.prisma.$queryRawUnsafe<
            Array<{
                insightVersionId: string;
                insightId: string;
                content: string;
                type: string;
                status: string | null;
                priority: number | null;
                similarity: number;
            }>
        >(sql);

        return rows.map((r) => ({
            ...r,
            similarity: Number(r.similarity),
        }));
    }

    async deleteByInsightVersionId(insightVersionId: string): Promise<void> {
        const sql = `
            UPDATE "insight_versions"
            SET "embedding" = NULL
            WHERE "id" = '${insightVersionId}'
        `;
        await this.prisma.$queryRawUnsafe(sql);
    }
}
