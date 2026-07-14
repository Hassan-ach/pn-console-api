/*
  Warnings:

  - You are about to drop the column `owners` on the `insight_versions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('EMAIL', 'GOOGLE', 'MICROSOFT', 'SSO');

-- AlterTable
ALTER TABLE "insight_versions" DROP COLUMN "owners",
ADD COLUMN     "broadcasted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "envolopsRef" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "insights" ADD COLUMN     "organization_id" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider_type" "ProviderType" NOT NULL DEFAULT 'EMAIL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_mappings" (
    "id" UUID NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "app_user_id" UUID NOT NULL,
    "plugin_name" TEXT NOT NULL,
    "platform_username" TEXT NOT NULL,

    CONSTRAINT "platform_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InsightVersionOwners" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_InsightVersionOwners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_provider_type_key" ON "users"("email", "provider_type");

-- CreateIndex
CREATE INDEX "platform_user_mappings_app_user_id_idx" ON "platform_user_mappings"("app_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_mappings_platform_user_id_plugin_name_key" ON "platform_user_mappings"("platform_user_id", "plugin_name");

-- CreateIndex
CREATE INDEX "_InsightVersionOwners_B_index" ON "_InsightVersionOwners"("B");

-- CreateIndex
CREATE INDEX "insights_organization_id_idx" ON "insights"("organization_id");

-- AddForeignKey
ALTER TABLE "platform_user_mappings" ADD CONSTRAINT "platform_user_mappings_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsightVersionOwners" ADD CONSTRAINT "_InsightVersionOwners_A_fkey" FOREIGN KEY ("A") REFERENCES "insight_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsightVersionOwners" ADD CONSTRAINT "_InsightVersionOwners_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
