-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to insight_versions
ALTER TABLE "insight_versions" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create IVFFlat index for approximate nearest neighbor search
-- (requires at least 100 records to build; can be recreated later with more centroids)
CREATE INDEX IF NOT EXISTS "insight_versions_embedding_idx"
    ON "insight_versions"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
