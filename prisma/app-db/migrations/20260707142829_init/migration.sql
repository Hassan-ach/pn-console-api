-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('TASK', 'INFO', 'URGENCY', 'DECISION');

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_versions" (
    "id" UUID NOT NULL,
    "insightId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "InsightType" NOT NULL,
    "content" TEXT NOT NULL,
    "owners" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insight_versions_insightId_idx" ON "insight_versions"("insightId");

-- CreateIndex
CREATE UNIQUE INDEX "insight_versions_insightId_version_key" ON "insight_versions"("insightId", "version");

-- AddForeignKey
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_versions_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
