# Database Schema Reference

`pn-console-api` uses a multi-database architecture consisting of two distinct PostgreSQL databases (managed via separate Prisma clients) and a Neo4j graph database.

---

## 🗄 Storage Architecture Overview

```
                               ┌─────────────────────────────────────────┐
                               │             pn-console-api              │
                               └────┬─────────────────┬─────────────┬────┘
                                    │                 │             │
                    DATABASE_URL    │ APP_DATABASE_URL│   NEO4J_URI │
                                    ▼                 ▼             ▼
┌──────────────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│ Raw Database (PostgreSQL 16)         │ │ App Database (Postgres)   │ │ Neo4j 5 Graph Database    │
│ High-throughput message ingestion    │ │ Domain entities, users,   │ │ Enterprise Knowledge      │
│ envelopes, payloads, cursors         │ │ insights, vector embeddings│ │ Graph (Entities/Edges)    │
└──────────────────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

---

## 1. App Database (`APP_DATABASE_URL`)

The App Database stores business domain entities, user authentication, RBAC configuration, business insights, AI action suggestions, chat history, and pgvector embeddings.

### Core Schema Tables

#### `users`
Stores registered platform users and identity metadata.
- `id` (UUID, PK)
- `organization_id` (String, nullable) — Multi-tenant organization identifier (defaults to `'org-1'`)
- `first_name` (String), `last_name` (String, nullable)
- `email` (String)
- `password_hash` (String, nullable) — Null for OAuth users
- `provider_type` (`EMAIL | GOOGLE | MICROSOFT | SSO`)
- `token_version` (Int) — Incremented to invalidate JWT tokens on logout
- `role` (`USER | ADMIN`) — Legacy user role
- `created_at`, `updated_at` (Timestamps)

#### `roles`
System and custom RBAC roles.
- `id` (UUID, PK)
- `name` (String, Unique) — Role name (e.g. `ADMIN`, `MEMBER`, `LEAD`)
- `description` (String, nullable)
- `created_at`, `updated_at` (Timestamps)

#### `teams`
Organizational teams and departments.
- `id` (UUID, PK)
- `organization_id` (String, nullable)
- `name` (String)
- `description` (String, nullable)
- `created_at`, `updated_at` (Timestamps)

#### `team_members`
User membership in teams with assigned role mappings.
- `id` (UUID, PK)
- `team_id` (UUID, FK -> `teams.id`, Cascade)
- `user_id` (UUID, FK -> `users.id`, Cascade)
- `role_ids` (String[]) — Array of role IDs assigned to the member in this team
- `created_at`, `updated_at` (Timestamps)

#### `insights`
Root insight entity container.
- `id` (UUID, PK)
- `organization_id` (String, nullable)
- `updated_at` (Timestamp)

#### `insight_versions`
Immutable version history of extracted business insights.
- `id` (UUID, PK)
- `insight_id` (UUID, FK -> `insights.id`, Cascade)
- `version` (Int) — Monotonically increasing version index
- `type` (`TASK | INFO | URGENCY | DECISION`)
- `content` (Text) — Insight narrative summary
- `broadcasted` (Boolean) — Whether visible to all organization users
- `envolops_ref` (String[]) — Array of source envelope UUID references
- `source_plugin` (String, nullable)
- `group_id`, `channel_id`, `topic_id` (Strings, nullable)
- `deadline` (Timestamp, nullable)
- `embedding` (`Unsupported("vector")`) — pgvector embedding for semantic search
- `created_at` (Timestamp)

#### `insight_version_owners`
Tracks owner-specific action status and deadline priorities.
- `id` (UUID, PK)
- `insight_version_id` (UUID, FK -> `insight_versions.id`, Cascade)
- `user_id` (UUID, FK -> `users.id`, Cascade)
- `status` (`PENDING | NOTED | DONE | BLOCKED | IN_REVIEW | DECIDED | DELEGATED | DELAYED | HIDDEN`)
- `priority` (Int, nullable) — 1–10 priority rating
- `created_at`, `updated_at` (Timestamps)

#### `unresolved_owners`
Holds raw extracted owner names prior to fuzzy platform user resolution.
- `id` (UUID, PK)
- `insight_version_id` (UUID, FK -> `insight_versions.id`, Cascade)
- `raw_name` (String) — E.g. `@alice` or `Alice Smith`
- `source_plugin` (String)

#### `insight_suggestions`
LLM-generated recommended action options per insight.
- `id` (UUID, PK)
- `insight_id` (UUID, FK -> `insights.id`, Cascade)
- `title` (String)
- `description` (Text)
- `action_type` (String) — E.g. `recommend`, `escalate`, `delegate`, `dismiss`
- `status` (`PENDING | APPLIED | REJECTED`)
- `created_at`, `updated_at` (Timestamps)

#### `conversations` & `chat_messages`
Multi-conversation chat history with SSE token streaming support.
- `conversations`: `id`, `user_id`, `title`, `created_at`, `updated_at`
- `chat_messages`: `id`, `conversation_id`, `role` (`user | assistant`), `content`, `tokens`, `created_at`

#### `jobs`
Event-driven tracking for long-running intelligence extraction runs.
- `id` (UUID, PK)
- `organization_id` (String)
- `user_id` (UUID, nullable)
- `type` (String) — E.g. `INTELLIGENCE_RUN`
- `status` (`PENDING | RUNNING | COMPLETED | FAILED`)
- `progress` (Int) — 0 to 100 percentage
- `message` (String, nullable)
- `metadata` (JSON)

---

## 2. Raw Database (`DATABASE_URL`)

High-volume, read-heavy ingestion database capturing messages from integrated platforms.

#### `envelope`
Normalized wrapper for ingested communication messages.
- `id` (UUID, PK)
- `source_plugin` (String) — E.g. `'telegram'`
- `source_id` (String) — Platform-native message ID
- `type` (`message`)
- `payload_ref` (UUID, FK -> `message_payload.id`)
- `has_attachment` (Boolean)
- `author_id` (String, nullable)
- `organization_id` (String, nullable)
- `occurred_at` (Timestamp with time zone)
- `ingested_at` (Timestamp with time zone)
- `status` (`PENDING | READY | FAILED`)
- `permissions` (JSON)

#### `message_payload`
Raw message contents, metadata, and structured entities.
- `id` (UUID, PK)
- `type` (`direct | email`)
- `content` (Text)
- `group_id`, `channel_id`, `reply_to`, `topic_id` (Strings, nullable)
- `reactions` (JSON)
- `pinned` (Boolean)
- `edited_date` (Timestamp)
- `entities` (JSON, nullable)
- `raw_payload` (JSON)

#### `plugin_cursor`
Stateful cursor tracking for backfill and live stream positioning.
- `id` (UUID, PK)
- `plugin_name` (String), `user_id` (String), `key` (String)
- `value` (BigInt) — Platform message offset or timestamp cursor
- `updated_at` (Timestamp)

#### `capability_failures`
Failed intelligence chunk execution log for automated retries.
- `id` (UUID, PK)
- `capability_name` (String)
- `chunk_id` (String)
- `error_message` (Text)
- `envelope_ids` (String[])
- `organizationId` (String)
- `resolved` (Boolean)

---

## 3. Knowledge Graph Database (Neo4j 5)

Neo4j stores enterprise organizational knowledge extracted continuously by the `knowledge-graph-extractor` LLM capability.

### Node Labels
- `Person`: `{ name: string, role?: string, email?: string, platformId?: string }`
- `Team`: `{ name: string, department?: string }`
- `Project`: `{ name: string, status?: string, codeName?: string }`
- `Service`: `{ name: string, repository?: string, environment?: string }`
- `Concept`: `{ name: string, definition?: string }`

### Relationship Types
- `(:Person)-[:WORKS_ON]->(:Project)`
- `(:Person)-[:BELONGS_TO]->(:Team)`
- `(:Person)-[:REPORTS_TO]->(:Person)`
- `(:Service)-[:DEPENDS_ON]->(:Service)`
- `(:Team)-[:OWNS]->(:Service)`
- `(:Project)-[:USES]->(:Service)`
