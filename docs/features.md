# Features

## 1. Authentication & User Management (`src/auth/`)

### Email/Password Auth
- Signup with email + password (bcrypt hashed)
- Login with JWT token issuance
- Token versioning for forced logout
- Global `JwtAuthGuard` with `@Public()` opt-out

### OAuth Providers
- **Google** — OAuth 2.0, login/create via `passport-google-oauth20`
- **Microsoft** — OAuth 2.0, login/create via `passport-microsoft`
- **SSO (OIDC)** — Generic OpenID Connect via `passport-openidconnect`

All providers: redirect to frontend with JWT, support signup/dashboard routing.

### Password Reset Flow
- **Forgot password** — Generates 10-min expiry token, sends email via SMTP/MailHog.
- **Browser relay** — Desktop app opens browser → browser hits `GET /api/auth/relay-reset-token?token=...` → backend marks `relayedAt` timestamp → desktop polls `GET /api/auth/pending-reset?email=...` → completes reset via `POST /api/auth/reset-password`. Handles the Tauri desktop app's lack of email client.
- **Reset password** — Returns a new JWT token on successful reset, so the user is automatically logged in.

### New User Background Processing
- `AuthService.signup()` and OAuth `loginOrCreate*User()` methods emit `Events.USER_SIGNED_UP` via `IEventBus` after user creation
- `SignupListener` (`@OnEvent(Events.USER_SIGNED_UP)`, wrapped in try/catch) handles two background tasks:
  1. **Broadcast assignment** — Assigns all latest broadcasted insight versions to the new user (deduplicates existing assignments)
  2. **Unresolved owner resolution** — Fuzzy-matches user's name (first, last, firstName+lastName, lastName+firstName) against all `UnresolvedOwner` records with `platformUsername` using Levenshtein distance (`OWNER_RESOLVER_MAX_DISTANCE`, default 1). Creates `InsightVersionOwner` records for matches, deletes resolved `UnresolvedOwner` records.

### Roles & Teams Management (RBAC)
- **Roles API** (`/api/roles`) — Full CRUD management of system and custom RBAC roles (`CreateRoleDto`, `UpdateRoleDto`). Admin-protected write endpoints.
- **Teams API** (`/api/teams`) — Organizational team creation, details lookup, and team hierarchy management.
- **Team Members API** (`/api/teams/:teamId/members`) — Manage team membership and assign role IDs per team member (`AddMemberDto`, `UpdateMemberDto`, `JoinTeamDto`). Supports joining (`/me`), updating own roles, leaving team, and admin member removal.

## 2. Chat (`src/chat/`) — MULTI-CONVERSATION

### Conversations & Context-Aware Streaming Responses with RAG
- **Conversation model** — New `Conversation` table (app-db); `ChatMessage.conversationId` (nullable, backfilled); messages cascade-delete with conversation
- `ChatService.streamResponse(userId, conversationId, userMessage, signal?)` — AsyncGenerator that:
  1. Loads last 20 messages of the conversation history
  2. Builds RAG context via `ChatContextService.buildContext(userId, userMessage)`
  3. Streams LLM response token-by-token via `LlmService.createStreamingLLM()`
  4. Persists USER + ASSISTANT messages in a transaction after streaming completes
  5. Auto-titles the conversation from the first message when the count reaches 2 (max 80 chars)
  6. Handles `AbortError` gracefully (SSE connection close)
- `ChatService.resolveConversation(userId, conversationId?)` — Explicit ID (ownership-checked) → latest active conversation (30-min inactivity timeout) → new conversation
- `ChatContextService.buildContext(userId, userMessage?)` — Hybrid RAG retrieval:
  - Structured filter query via `EmbeddingRepository.findByFilters()` (when type/status keywords detected: info, task, urgency, decision, pending, done, etc.)
  - Semantic search via vector embedding (cosine distance with fallback thresholds 0.65 → 0.45)
  - Recent insights fallback for broad queries
  - Formats insights with deadline labels: OVERDUE, DUE TODAY, in N day(s)

### Chat History & Persistence
- `ChatMessage` model in app-db (Prisma): `{ id, userId, conversationId?, role (USER|ASSISTANT), content, createdAt }`
- `ChatService.getHistory(userId, conversationId?, page?, limit?)` — Paginated messages ordered ascending (falls back to latest conversation)
- `ChatService.getConversations(userId, page?, limit?)` — Paginated conversation list with messageCount + last message preview
- `ChatService.createConversation(userId)` / `deleteConversation(userId, conversationId)` — Conversation lifecycle
- `ChatService.retractLastMessages(userId, conversationId?)` — Delete last USER+ASSISTANT pair (for retry)
- Cascade delete with User and Conversation models

### Chat API
- `GET /api/chat/conversations` — Paginated conversation list
- `POST /api/chat/conversations` — Create empty conversation
- `DELETE /api/chat/conversations/:id` — Delete conversation + messages
- `GET /api/chat/messages?conversationId=` — Paginated messages for a conversation
- `POST /api/chat/messages` — Sends message, returns SSE stream: `{type:'metadata', conversationId}`, `{type:'token',content}`, `{type:'done'}`, `{type:'error',message}` + `:keepalive` every 15s. Aborts LLM stream on client disconnect via `AbortController`.
- `DELETE /api/chat/messages/retract-last?conversationId=` — Delete last USER+ASSISTANT pair

### Embeddings Infrastructure — UPDATED
- pgvector extension on app-db with **unconstrained `vector` column** on `insight_versions` (any dimensions, e.g. 768 for nomic) + IVFFlat index (`vector_cosine_ops`, 100 lists)
- `prisma/app-db/init-vector.ts` — setup script (extension, column, index); run via `prisma:push` / `db:setup`
- `EmbeddingService` — Supports OpenAI (`text-embedding-3-small`), Ollama (`nomic-embed-text`), Google GenAI (`text-embedding-004`)
- `EmbeddingRepository.upsert()` — Raw SQL UPDATE for vector column
- `EmbeddingRepository.searchSimilar()` — Cosine distance (`<=>`), latest-version join, vector-dimension equality check, optional user filter, fallback threshold
- `EmbeddingRepository.findByFilters()` — Structured query by type/status (no embedding needed, returns similarity=1.0)
- `EmbeddingRepository.findNullEmbeddings()` — Finds versions with NULL embeddings for backfill
- **Background embedding generation** — `InsightEmbeddingListener` (new) handles `INSIGHT_VERSIONS_CREATED` / `EMBEDDINGS_GENERATE` events with retry (3 attempts, exponential backoff); `InsightPersistenceService` publishes the events after persist and backfills missing embeddings on startup

## 3. Profile (`src/profile/`)

### User Profile Metadata
- `GET /api/profile/meta-data` — Returns `{ id, firstName, lastName, email }` for authenticated user
- `ProfileMetaDataDto` with Swagger + class-transformer exposure
- Backed by `UserRepository.findById()`

## 4. Jobs (`src/jobs/`)

### Job Tracking Infrastructure
- `Job` model in app-db (Prisma): `{ id, userId, organizationId, title, description, progressable, progress, message, status, startedAt, completedAt, createdAt, updatedAt }`
- `JobStatus` enum: `PENDING | RUNNING | COMPLETED | FAILED`

### Read-Only API
- `GET /api/jobs` — List jobs for user, optional `?status=` filter, ordered by createdAt desc (max 50)
- `GET /api/jobs/:id` — Single job by ID

### Job Service
- `JobService` — Full CRUD: create, get, list, start, update (title, description, message, progress, progressable), complete, fail
- `JobRepository` — Prisma wrapper with `findByUserId` supporting status filter

### Event-Driven Tracking
- `JobTrackingListener` — Listens for `job.intelligence.*` events to auto-create/update jobs from intelligence engine runs
- Intelligence events: started, setTitle, setDescription, setProgressable, setProgress, message, completed, failed

## 5. Plugin Activation & Worker System (`src/ingestion/plugins/`)

### Lifecycle Management
Plugins go through a state machine via `PluginStatus` enum:

```
NOT_CONNECTED → CONNECTED → CONFIGURED → ACTIVATING → ACTIVE ↔ DEACTIVATING → CONFIGURED
                                                              ↘ ERROR
```

- `POST /api/plugins/:name/activate` — Transitions plugin to `ACTIVE`, spawns `IngestionWorker` per configured chat; publishes `plugin.activated` event
- `POST /api/plugins/:name/deactivate` — Aborts all workers, sets status to `CONFIGURED`; publishes `plugin.deactivated` event
- `GET /api/plugins/:name/status` — Returns current `PluginStatus` + per-chat `WorkerState[]` (includes `platformUsername`, `platformUserId`)
- `GET /api/plugins/:name/config-schema` — Returns field schema for dynamic activation UI
- `GET /api/plugins/:name/activation-requirements` — Returns validation requirements per config field

### IngestionWorker (`src/ingestion/workers/ingestion-worker.service.ts`) — MOVED from `plugins/services/`
Per-chat worker that runs two concurrent phases:
1. **Backfill** — Historical catch-up using cursor (or up to `historyLimit`), emits progress, persists cursor after each batch
2. **Stream** — Live listening via `IPlugin.startStream()`, batches envelopes with `BatchBuffer` (configurable via `ingestion.dbBatchSize` / `ingestion.dbBatchWindowMs`), publishes `envelopes.ingested` events via `IEventBus`

After backfill completes, publishes `envelopes.ingested` event with `isBackfill: true` (triggers intelligence engine for backlog processing).

### WorkerManager (`src/ingestion/workers/worker-manager.service.ts`) — MOVED + REFACTORED
Manages all `IngestionWorker` instances with:
- **Abstracted coordination** — Uses `ILockManager` (injected via `LOCK_MANAGER_TOKEN`) instead of direct `RedisService`
- **Event-driven lifecycle** — Subscribes to `plugin.activated`, `plugin.deactivated`, `plugin.config.updated` events via `IEventBus`
- **Dynamic worker syncing** — On config update, `syncWorkersForConfig()` stops workers for removed chats, starts workers for new chats
- **Startup recovery** — On bootstrap, re-acquires all active listeners from DB via `ILockManager.acquire()`
- **Shutdown cleanup** — Releases all locks on shutdown
- **Error handling** — Detects session-expired errors and triggers `WorkerRecoveryService` to restart with new owner config

### Plugin Interface & Base Provider (`src/ingestion/plugins/`)
- `IPlugin<TConfig>` — Now generic, `parseConfig?(raw)` returns typed config
- `BasePluginProvider<TConfig>` — New abstract class implementing `IPlugin` with `parseConfig()`, abstract `validateAuthImpl()` and `isConnectedImpl()`
- `getConfigSchema()` — Returns `ConfigFieldSchema[]` for dynamic activation UI
- `getActivationRequirements()` — Returns `ActivationRequirement[]` validation rules per config field
- `backfill()` accepts `AbortSignal` (caller controls cancellation)
- `stopStream()` removed — callers use `AbortSignal` instead
- `startStream()` receives `cursor?: number` in `StreamOpts` for resume
- `ConfigFieldSchema` — `{ key, label, type, required, placeholder?, description? }`
- `BaseProviderConfig` — `{ chats: ProviderChatEntry[], [key: string]: unknown }`
- `ProviderChatEntry` — `{ id, name, historyLimit? }`
- `PluginConfigService` — Extracted from `PluginManagerService`; handles config CRUD, publishes `plugin.config.updated` events

## 6. Common Providers (`src/common/providers/`) — NEW

Global module providing abstract infrastructure interfaces with in-memory implementations (replaces previous `RedisService`/`RedisModule`).

**`IEventBus`** — Injected via `EVENT_BUS_TOKEN` — TYPED + RETRY
- `publish(event, payload)` / `publishAsync(event, payload)` / `subscribe(event, handler, options?)` — typed via `EventMap`; `subscribe` returns `UnsubscribeFn`
- `SubscribeOptions` — `{ retries?, backoffMs? }` — failed handlers retried with exponential backoff
- **`events.registry.ts`** — Central `Events` catalog (user.signed.up, envelopes.ingested, insight.versions.created, embeddings.generate, plugin.activated/deactivated/config.updated, job.intelligence.*)
- Backed by NestJS `EventEmitter2`; all modules publish/subscribe via `Events.*` constants

**`ILockManager`** — Injected via `LOCK_MANAGER_TOKEN`
- `acquire(key, ownerId, ttlMs?)` / `release(key, ownerId)` / `isLocked(key)` — Distributed lock primitives
- `InMemoryLockManager` — Uses `Map<string, LockEntry>` with auto-expiry

**`ICacheStore`** — Injected via `CACHE_STORE_TOKEN`
- `get<T>(key)` / `set<T>(key, value, ttlMs?)` / `delete(key)` — Key-value cache
- `InMemoryCacheStore` — Uses `Map<string, CacheEntry>` with TTL expiry
- **Used by `PluginConfigRepository`** — 60s TTL cache for plugin config lookups, invalidated on writes

**`CommonProvidersModule`** — `@Global()` module, wires all three.

### Provider Utilities (`src/ingestion/plugins/utils/provider-utils.ts`) — NEW
- `extractProviderChats(config)` — Safely extracts `ProviderChatEntry[]` from raw config
- `isSessionExpired(err)` — Detects Telegram session expiry (`AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, etc.)
- `maskSecret(secret)` — Masks secrets for safe display
- `resolvePluginConfig(configService, pluginName, key, defaultValue, aliasKey?)` — Plugin-specific config with global ingestion fallback

## 7. Ingestion Pipeline (`src/ingestion/`)

### Plugin System
- **Plugin interface** (`IPlugin`): `backfill`, `startStream`, `validateAuth`, `isConnected`, `getConfigSchema?`, `getActivationRequirements?`
- **PluginManagerService** — Registry of plugin instances; CRUD for plugin configs
- **PluginContext** — Abstraction layer providing config, envelopes, cursor, user mapping
- **Telegram plugin** — Separate module with topic store, backfill modes (first/last), connection retries

### Deduplication
- `EnvelopeRepository.createManyWithPayload` deduplicates by `(sourcePlugin, sourceId)` composite unique constraint + in-memory check
- **Cursor tracking** — Plugins persist/recover cursor position via `plugin_cursor` table

### Ingestion Events (`src/ingestion/events/`) — NEW
- `PluginActivatedEvent` — `{ userId, pluginName, config }`
- `PluginDeactivatedEvent` — `{ userId, pluginName, config }`
- `PluginConfigUpdatedEvent` — `{ userId, pluginName, config }`
- `EnvelopesIngestedEvent` — `{ organizationId, userId, pluginName, chatId, envelopeIds, isBackfill }`

### Event-Driven Processing
- After backfill/streaming, plugins publish `envelopes.ingested` via `IEventBus` (using `Events.ENVELOPES_INGESTED`)
- `EnvelopesIngestedListener` (`src/intelligence/triggers/`) triggers the intelligence pipeline with scoped envelope bag or full processing (for backfill, `progressable: true`)

## 8. Intelligence Engine (`src/intelligence/`)

### Architecture
Orchestration pipeline: **Context Building → Chunking → Capability Execution → Persistence**

### Context Building
- `EnterpriseContextBuilder` (abstract) — Yields `EnterpriseContext` objects with envelopes, window metadata, and `previousIntelligence()` function
- `InMemoryEnterpriseContextBuilder` — Implementation that:
  1. Discovers time windows via recursive SQL (groups days until `minMessages` threshold met)
  2. Loads envelopes within each window
  3. Provides scoped previous-intelligence queries (by sourcePlugin, groupId, channelId, topicId)

### Chunking Pipeline
- **Partitioners** (configurable order via `chunking.partitionStrategy`):
  - `SourcePartitioner` — By source plugin
  - `GroupIdPartitioner` — By group ID
  - `ChannelIdPartitioner` — By channel ID
  - `TopicIdPartitioner` — By topic ID (currently disabled in default config)
  - `DailyPartitioner` — By date with configurable min/max chunk size
- `CompositeChunkingStrategy` — Runs all configured partitioners
- Strategies: `TimeGapChunkStrategy`, `AdaptiveChunkStrategy`

### Capability System
- **`ICapability`** interface — `{ name, execute(input) }`
- **`CapabilityManager`** — Registry that executes capabilities by name. Pipeline calls them sequentially (KG first, then V2 extraction).
- **Capabilities registered**: KG extractor → V1 extractor → V2 extractor → suggestions extractor

### Knowledge Graph Extraction — REWRITTEN (direct structured extraction)
- **`KnowledgeGraphExtractionCapability`** (`knowledge-graph-extractor`) — Direct structured KG extraction:
  - Single LLM call via `createGraphLLM()`, validated against Zod `KnowledgeGraphSchema`
  - Writes entities/relationships straight to **Neo4j** via `Neo4jService` (non-fatal if Neo4j unavailable)
  - Entity types: Person, Team, Project, Service, Repository, Document, Ticket, Channel
  - Relationship types: WORKS_ON, OWNS, DEPENDS_ON, REFERENCES, BELONGS_TO, MENTIONS
  - Dedicated graph LLM config (`LLM_GRAPH_PROVIDER`, `LLM_GRAPH_MODEL`)
  - Non-fatal in pipeline: errors logged + recorded as capability failures

### Insight Extraction V2 — primary extractor
- **`InsightExtractionCapabilityV2`** (`insights-extractor-v2`) — Enhanced extraction with KG + search tools:
  - Uses `GraphToolsService` (Neo4j) + `SearchToolsService` (raw messages / insights / vector RAG) for disambiguation
  - 5-tier batch owner resolution: exact platformUserId → exact username → fuzzy user name via Levenshtein → exact org user → fuzzy org user
  - Loads all PlatformUserMappings + Organization users for comprehensive matching
  - Supports `excludeAuthor`, `broadcasted`, `priority`, `deadline` fields
  - **Broadcast accuracy fix**: `broadcasted` only when LLM explicitly set it, or no owners AND no unresolved refs
  - Configurable retries and max tool iterations

### Suggestion Generation — NEW
- **`SuggestionsCapability`** (`suggestions-extractor`) — Analyzes extracted insights with KG context:
  - Generates context summaries (2 bullet points) and action options (2-3 options: A, B, C)
  - Action types: RECOMMENDATION, RISK_MITIGATION, NEXT_STEP, REASSIGN, ESCALATE, DELEGATE, DISMISS
  - Persists to `insight_suggestions` table
  - Skip when no insights in context (no-op for empty pipelines)

### Suggestions API — NEW
- `GET /api/suggestions` — List suggestions for user (optional `?status=` filter)
- `GET /api/suggestions/insight/:insightId` — Get or auto-generate suggestions for an insight
- `POST /api/suggestions/generate/:insightId` — Trigger on-demand suggestion generation
- `PATCH /api/suggestions/:id/status` — Update suggestion status (on ACCEPTED/COMPLETED, resets peers to PENDING)

### Knowledge Graph Storage — Neo4j
- `Neo4jService` (`src/graph/`) — wraps `neo4j-driver` + LangChain `Neo4jGraph`; `executeRead`/`executeWrite` Cypher helpers; env `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`; docker-compose `neo4j:5-community` service with APOC
- Entities merged on `(name, orgId)` with role metadata; relationships merged between entity IDs
- PostgreSQL `Entity`/`Relationship` tables and repositories **removed** after the migration
- `InsightSuggestionRepository` — CRUD with findByUser (joins through owned/broadcasted insights), batch create

### Graph Tool Service (`GraphToolsService`) — Neo4j-backed
- 6 StructuredTool instances for LLM agent: `search_graph`, `get_entity`, `get_neighbors` (BFS up to `GRAPH_MAX_NEIGHBOR_DEPTH`, default 2), `create_entities`, `update_entities`, `create_relationships` — all backed by Cypher
- Used by V2 extraction and suggestions capabilities

### Search Tool Service (`SearchToolsService`) — NEW
- 3 StructuredTool instances for LLM agent: `search_raw_messages` (keyword search over envelopes), `search_insights` (keyword search over insights), `retrieve_relevant_insights` (vector RAG via embeddings, 0.45 threshold)
- Used by V2 extraction for grounding answers in real data

### LLM Service — UPDATED
- `createGraphLLM()` — Dedicated LLM for graph operations with separate config
- `createStreamingLLM()` — Streaming model for SSE chat responses
- `createToolChain()` — Multi-iteration tool-calling chain with configurable max iterations

### LLM Extraction Prompt — `excludeAuthor` Field — NEW
- `excludeAuthor: boolean` controls whether the message author(s) are excluded from insight ownership
  - `true` when author is delegating or asking others to act (e.g. "could someone do X?", "Bob, can you do X?")
  - `false` when author self-commits or insight is general information
  - Default: `false`
  - When `true` + `broadcasted: true` → shown to everyone except the author
  - When `true` + specific owners → only those owners (minus the author)
- Prompt includes current date for deadline calculation
- Priority (1-10) and deadline (ISO 8601) extraction reinforced in prompt

### LLM Integration
- Multi-provider support via `langchain/chat_models/universal`:
  - OpenAI, Anthropic, Google Gemini, Ollama, xAI, OpenRouter
- Tool-calling chain with configurable max iterations

### Persistence
- `InsightPersistenceService` — Batch create/update with versioning (passes `priority`, `deadline`, `excludedUserIds`); publishes `INSIGHT_VERSIONS_CREATED` events for background embedding generation; backfills missing embeddings on startup
- `InsightEmbeddingListener` — background embedding generation with retry (3 attempts, exponential backoff)
- `InsightRepository` deduplicates owner IDs and unresolved owner refs before persist
- Supports broadcasted-with-exclusions: when `excludedUserIds` set, assigns to all users except excluded (instead of true broadcast)
- Tracks unresolved owner references separately

### Backfill Intelligence Trigger
- `IngestionWorker` automatically triggers intelligence engine after backfill completes for each chat
- `EnvelopesIngestedListener` passes collected `envelopeIds` for scoped processing with job progress tracking (`progressable: true`)
- **Telegram gap-fill** — backfill now resumes from the stored cursor: fetches only messages newer than the cursor (`minId`), skips ≤ cursor, and saves the max message ID as the new cursor

## 9. Insights API (`src/insights/`)

### Core CRUD
- List insights for user (owner or broadcasted), optional type and status filter; returns `priority` and `deadline`
- Get insight detail with latest version (includes `status`, `latestVersionId`, scoping fields, `priority`, `deadline`)
- Version history — all versions of an insight (includes `priority` and `deadline`)
- Specific version retrieval with envelope references
- `InsightRepository.findByScope()` — Query insights by source plugin, group/channel/topic ID

### Priority & Deadline — NEW
- `PATCH /api/insights/:id/priority?priority=N` — Override priority (1-10) on any insight
- `InsightPriorityQueryDto` — Validates integer 1-10
- `InsightActionRepository.upsertPriority(insightVersionId, userId, priority)` — UPSERT on `insight_version_owners.priority`
- LLM extraction now assigns `priority` (1-10) and `deadline` (ISO 8601) during insight extraction
- Database: `insight_versions.deadline` (TIMESTAMP), `insight_version_owners.priority` (INTEGER)
- Prompt updated to include current date for deadline calculation

### Action Status Management
- Set per-owner action status: `PENDING`, `NOTED`, `DONE`, `BLOCKED`, `IN_REVIEW`, `DECIDED`, `DELEGATED`, `DELAYED`, `HIDDEN`
- Action validation per insight type (e.g., `TASK` → `DONE|BLOCKED|IN_REVIEW`)
- `InsightActionRepository.upsert` for unique `(insightVersionId, userId)`

## 10. Demo / Testing Endpoints (`src/demo/`)

- **Envelope count** — Quick DB health for ingestion
- **Insights generate** — Direct LLM extraction from provided messages (no ingestion needed)
- **Insights persist** — Manually persist extracted insights
- **Insights fetch** — View all persisted insights

## 11. Mail Service (`src/mail/`)

- Nodemailer-based SMTP transport
- Password reset email with styled HTML template
- Configurable via SMTP env vars, works with MailHog for dev

## 12. Infrastructure

### Database (PostgreSQL 16)
- **Raw DB** (`DATABASE_URL`): `envelope`, `message_payload`, `plugin_cursor`, `capability_failures`
- **App DB** (`APP_DATABASE_URL`): `users`, `password_reset_tokens`, `insights`, `insight_versions`, `insight_version_owners`, `unresolved_owners`, `platform_user_mappings`, `plugin_configs`, `jobs`, `chat_messages`, `conversations`, `active_chat_listeners`
- **Neo4j (graph DB)**: `neo4j:5-community` docker service — enterprise knowledge graph (entities, relationships)

### Telegram Plugin
- **Moved** from `src/ingestion/plugins/telegram/` → `src/ingestion/plugins/providers/telegram/`
- **Refactored into three services**: `TelegramBackfillService` (backfill extraction), `TelegramStreamService` (live streaming), `TelegramPluginService` (orchestration, implements `IPlugin` via `BasePluginProvider`)
- **`TelegramClientFactory`** — Creates GramJS client with DC IP override for production (bypasses `web.telegram.org` WebSocket requirement)
- **`parseConfig()`** — Returns typed `TelegramConfig` object (`{ apiId, apiHash, sessionString, chats, ... }`)
- **Configurable topic store** — `TelegramTopicStore` accepts `basePath` and `fileSuffix` via config (`telegram.topicStoreBasePath`, `telegram.topicStoreFileSuffix`)
- **Backfill modes** — `'first'` (oldest first) or `'last'` (newest first), configurable via `ingestion.backfillMode` (moved from `telegram` namespace)
- **Connection retries** — Number of retries on connection failure, configurable via `telegram.connectionRetries`
- **WebSocket MTProto** — Configurable via `telegram.useWSS` (default: `true`)
- **Backfill offset** — Configurable via `telegram.backfillOffsetId` (default: `1`)
- **Cursor gap-fill** — backfill fetches only messages newer than the stored cursor (`minId`), stopping at the cursor boundary; cursor advanced to max fetched message ID

### Docker Compose
- PostgreSQL 16-alpine
- MailHog (SMTP testing)
- Keycloak (SSO/OIDC testing)

### Swagger
- Auto-generated OpenAPI docs at `/api/docs`
- Bearer auth support
- All endpoints documented via `@nestjs/swagger` decorators
