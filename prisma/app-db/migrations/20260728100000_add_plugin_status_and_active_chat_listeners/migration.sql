-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'CONFIGURED', 'ACTIVATING', 'ACTIVE', 'DEACTIVATING', 'ERROR');

-- AlterTable
ALTER TABLE "plugin_configs" ADD COLUMN     "status" "PluginStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
ADD COLUMN     "activated_at" TIMESTAMPTZ,
ADD COLUMN     "error_message" TEXT;

-- CreateTable
CREATE TABLE "active_chat_listeners" (
    "id" UUID NOT NULL,
    "plugin_name" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "subscriber_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_chat_listeners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_chat_listeners_plugin_name_chat_id_key" ON "active_chat_listeners"("plugin_name", "chat_id");
