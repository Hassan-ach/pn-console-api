import { PrismaClient } from '../../generated/app-db-client';
import { OpenAIEmbeddings } from '@langchain/openai';

const BATCH_SIZE = 20;

const prisma = new PrismaClient();

async function main() {
    console.log('[backfill-embeddings] Starting backfill...');

    const embedder = new OpenAIEmbeddings({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        apiKey:
            process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || undefined,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
    });

    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
        const versions = await prisma.$queryRawUnsafe<
            Array<{ id: string; content: string }>
        >(
            `SELECT "id", "content"
             FROM "insight_versions"
             WHERE "embedding" IS NULL
             LIMIT ${BATCH_SIZE}`,
        );

        if (versions.length === 0) {
            hasMore = false;
            break;
        }

        const contents = versions.map((v) => v.content);
        const ids = versions.map((v) => v.id);

        try {
            const embeddings = await embedder.embedDocuments(contents);

            for (let i = 0; i < ids.length; i++) {
                const vector = `[${embeddings[i].join(',')}]`;
                await prisma.$executeRawUnsafe(
                    `UPDATE "insight_versions" SET "embedding" = '${vector}'::vector WHERE "id" = '${ids[i]}'`,
                );
            }

            totalProcessed += versions.length;
            console.log(
                `[backfill-embeddings] Processed ${totalProcessed} insights`,
            );
        } catch (error) {
            console.error(
                `[backfill-embeddings] Failed batch: ${(error as Error).message}`,
            );
        }
    }

    console.log(
        `[backfill-embeddings] Complete. Total: ${totalProcessed} embeddings generated.`,
    );
}

main()
    .catch((e) => {
        console.error('[backfill-embeddings] Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
