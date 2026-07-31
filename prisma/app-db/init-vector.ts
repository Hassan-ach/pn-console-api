import { PrismaClient } from '../../generated/app-db-client';

const prisma = new PrismaClient();

async function runSql(description: string, sql: string) {
    try {
        await prisma.$executeRawUnsafe(sql);
    } catch (e) {
        // Log quietly if already applied or non-fatal
        const msg = (e as Error).message;
        if (!msg.includes('already exists') && !msg.includes('column does not have dimensions')) {
            console.warn(`[init-vector] ${description} notice: ${msg}`);
        }
    }
}

async function main() {
    console.log('[init-vector] Configuring pgvector extension, embedding column, and index...');

    await runSql('Enable vector extension', `CREATE EXTENSION IF NOT EXISTS vector;`);
    await runSql('Add embedding column', `ALTER TABLE "insight_versions" ADD COLUMN IF NOT EXISTS "embedding" vector;`);
    await runSql('Unconstrain embedding type', `ALTER TABLE "insight_versions" ALTER COLUMN "embedding" TYPE vector;`);
    await runSql('Create IVFFlat index', `CREATE INDEX IF NOT EXISTS "insight_versions_embedding_idx" ON "insight_versions" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);`);

    console.log('[init-vector] pgvector configured successfully.');
}

main()
    .catch((e) => {
        console.error('[init-vector] Warning:', (e as Error).message);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
