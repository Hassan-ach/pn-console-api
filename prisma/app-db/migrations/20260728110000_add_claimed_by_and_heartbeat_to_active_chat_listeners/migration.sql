-- AlterTable
ALTER TABLE "active_chat_listeners" ADD COLUMN     "claimed_by" TEXT,
ADD COLUMN     "heartbeat_at" TIMESTAMPTZ;
