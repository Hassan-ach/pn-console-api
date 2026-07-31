-- Unconstrain embedding vector column from vector(1536) to vector to support 768-dimension and other model embeddings
DROP INDEX IF EXISTS "insight_versions_embedding_idx";

ALTER TABLE "insight_versions" ALTER COLUMN "embedding" TYPE vector;

CREATE INDEX IF NOT EXISTS "insight_versions_embedding_idx"
    ON "insight_versions"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
