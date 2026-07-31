-- Add insight broadcast levels (ORG / TEAM / ROLE / DIRECT)
CREATE TYPE "InsightBroadcastLevel" AS ENUM ('DIRECT', 'ORG', 'TEAM', 'ROLE');

ALTER TABLE "insight_versions" ADD COLUMN "broadcast_level" "InsightBroadcastLevel";
ALTER TABLE "insight_versions" ADD COLUMN "broadcast_target_id" UUID;
ALTER TABLE "insight_versions" ADD COLUMN "broadcast_target_name" TEXT;

-- Create indexes
CREATE INDEX "insight_versions_broadcast_level_idx" ON "insight_versions"("broadcast_level");
