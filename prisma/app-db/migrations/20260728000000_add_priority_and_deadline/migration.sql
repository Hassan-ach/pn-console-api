-- AlterTable
ALTER TABLE "insight_versions" ADD COLUMN "deadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "insight_version_owners" ADD COLUMN "priority" INTEGER;
