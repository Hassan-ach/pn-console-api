-- Create Conversation table
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Add conversation_id to chat_messages (nullable for backward compat)
ALTER TABLE "chat_messages" ADD COLUMN "conversation_id" UUID;

-- Create indexes
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations"("user_id", "updated_at" DESC);
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at" ASC);

-- Add foreign key constraints
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;

-- Backfill: create a conversation per user for all existing messages
INSERT INTO "conversations" ("id", "user_id", "title", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "user_id",
    'Previous messages',
    MIN("created_at"),
    MAX("created_at")
FROM "chat_messages"
GROUP BY "user_id";

-- Assign existing messages to their user's default conversation
UPDATE "chat_messages" AS cm
SET "conversation_id" = c."id"
FROM "conversations" AS c
WHERE cm."user_id" = c."user_id"
  AND cm."conversation_id" IS NULL;
