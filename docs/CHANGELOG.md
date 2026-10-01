# Changelog

## 2026-07-31 — Commit `9ebc203`

*Multi-conversation chat, Neo4j graph storage (replacing PostgreSQL KG tables), search tools for LLM, event-bus registry with retry, plugin-config caching, Telegram backfill gap-fill, unconstrained embedding vectors with missing-embedding backfill.*

### Commits (15 new, 294 total)

| Hash | Message |
|------|---------|
| `9ebc203` | fix(lint): resolve typescript-eslint unused variables and unbound method warnings |
| `b6aed7e` | Merge branch 'HA_1007_cleaning' into HA_1007 |
| `3c3f703` | Merge branch 'main' of ssh.dev.azure.com:v3/pipenile/Mosaid/pn-console-api into HA_1007 |
| `55a3ca0` | fix(chat,db): make conversationId optional and unconstrain embedding vector dimensions |
| `9477778` | Merged PR 613: feat(intelligence): KG extraction, V2 insight enhancements, search tools, Neo4j integration, and backfill gap-fill |
| `dea23cd` | refactor(event-bus): standardize event publishers and listeners across auth, intelligence, ingestion, and jobs modules |
| `c1573c5` | refactor(event-bus): introduce central Events registry, typed IEventBus, and retry mechanism |
| `d0f9d38` | feat(cache): implement in-memory caching for plugin configuration lookups |
| `9f29deb` | refactor: clean up dead code, consolidate LLM response helper, remove unused dependencies, and connect config namespaces |
| `e572159` | refactor(kg): remove unused PostgreSQL Knowledge Graph schema models and repositories after Neo4j migration |
| `587d04f` | style: fix eslint linting errors |
| `6a40273` | Merge branch 'main' of ssh.dev.azure.com:v3/pipenile/Mosaid/pn-console-api into HA_1007 |
| `687e3cf` | fix(ingestion): add cursor gap-fill backfill and fix empty ingestion job triggers |
| `6f3d3ec` | feat(intelligence): enhance graph tools, kg extraction, embeddings and search |
| `6bda2c4` | Merged PR 610: add multiple conversations |

### Files (75 changed, 3827 insertions, 1647 deletions)

**New files:** `prisma/app-db/init-vector.ts`, migrations `20260730112940_add_conversations`, `20260731000000_unconstrain_embedding_vector_dimensions`, `src/graph/graph.module.ts`, `src/graph/neo4j.service.ts`, `src/common/providers/event-bus/events.registry.ts`, `src/intelligence/tools/search-tools.service.ts`, `src/intelligence/store/insight-embedding.listener.ts`, `src/intelligence/capabilities/knowledge-graph-extraction/kg-schema.ts`, `src/intelligence/utils/llm-response.utils.ts`, specs for `telegram-backfill.service`, `insight-embedding.listener`, `plugin-config.repository`

**Deleted:** `src/repositories/entity.repository.ts` (+spec), `src/repositories/relationship.repository.ts` (+spec), `src/intelligence/capabilities/knowledge-graph-extraction/kg-extraction-schema.ts`, `src/intelligence/merge/merge.module.ts`, `src/intelligence/triggers/envelopes-ingested.event.ts`, `TelegramSession`/`PendingAuth` types

**Dependencies:** added `neo4j-driver`, `@langchain/community`; removed `@prisma/adapter-pg`, `ioredis`, `@types/ioredis`, `pg`

### Multi-Conversation Chat

- New `Conversation` Prisma model (app-db) with `ChatMessage.conversationId` (nullable, backfilled per user in migration)
- `ChatController`: `GET/POST /chat/conversations`, `DELETE /chat/conversations/:id`; SSE stream now emits `metadata` (with `conversationId`), `token`, `done`, `error` events + 15s keepalive heartbeat
- `ChatService`: `getConversations()`, `createConversation()`, `resolveConversation()` (30-min inactivity timeout before a new conversation is created), `deleteConversation()`, `retractLastMessages(conversationId?)`, `streamResponse()` persists into the target conversation and auto-titles it from the first message (max 80 chars)
- `SendMessageDto.conversationId` optional UUID

### Neo4j Graph Storage (PR 613)

- New `GraphModule` (global) + `Neo4jService` — wraps `neo4j-driver` + LangChain `Neo4jGraph`; `executeRead()`/`executeWrite()`; env `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`; docker-compose `neo4j:5-community` service with APOC
- Removed PostgreSQL `Entity`/`Relationship` models, `EntityRepository`, `RelationshipRepository`, empty `MergeModule`
- `GraphToolsService` rewritten to run Cypher against Neo4j (MERGE on `name`+`orgId`, role metadata, `GRAPH_MAX_NEIGHBOR_DEPTH` default 2)
- `KnowledgeGraphExtractionCapability` switched from agentic tool-calling to direct structured extraction (one LLM call validated with `kg-schema.ts`), writing results via `Neo4jService`
- New `SearchToolsService` with 3 LLM tools: `search_raw_messages`, `search_insights`, `retrieve_relevant_insights` (vector RAG, 0.45 threshold)

### Embeddings & Backfill

- `embedding` column unconstrained from `vector(1536)` to `vector` (supports 768-dim models); `init-vector.ts` script configures pgvector + IVFFlat index, wired into `prisma:push` and new `db:setup` script
- `EmbeddingRepository`: new `findByFilters()` (structured, no embedding), `findNullEmbeddings()`, `deleteByInsightVersionId()`; `searchSimilar()` now joins latest versions and checks vector dimensions
- New `InsightEmbeddingListener` — background embedding generation with retry (3 attempts, exponential backoff) on `INSIGHT_VERSIONS_CREATED` / `EMBEDDINGS_GENERATE` events
- `InsightPersistenceService` publishes embedding events after persist and backfills missing embeddings on module init

### Event Bus & Cleanup

- Central `events.registry.ts`: `Events` constants + typed `EventMap`; `IEventBus` typed, `subscribe()` supports retry/backoff options; `InMemoryEventBus` retries handlers with exponential backoff
- All modules migrated to `Events.*` constants (auth, ingestion, intelligence, jobs); intelligence engine trigger moved to `envelopes-ingested.listener.ts` which passes `progressable: event.isBackfill`
- `PluginConfigRepository`/`PluginConfigService`: 60s TTL in-memory cache via optional `ICacheStore`; deactivation event on config update; worker activation requires ACTIVE status + session string
- Telegram backfill: cursor-based gap-fill (`minId`, skip ≤ cursor, save max msg id)
- `extractJsonString()` consolidated into `llm-response.utils.ts`; auth strategies read namespaced config (`jwt.secret`, `oauth.*`) with env fallback; `InsightRepository` dedupes owners/unresolved owners; V2 extractor `broadcasted` accuracy fix

---

## 2026-07-30 — Commit `2ce5d26`

*Knowledge Graph extraction, Insight Extraction V2 with KG context, LLM-powered suggestions with REST API, RAG for chat with pgvector embeddings.*

### Commits (29 new, 279 total)

| Hash | Message |
|------|---------|
| `5d0d1a9` | Merged PR 611: feat(intelligence): LLM-powered suggestions with KG context + REST API |
| `820ec0a` | fix(linting) |
| `d06c325` | feat(suggestions): implement on-demand item suggestions capability, REST API, and DB enum updates |
| `24625fc` | Merged PR 606: feat(intelligence): orgid context, DeepSeek support, and robust V2 insight extraction |
| `f6b35d7` | Merged PR 608: fix(insights): switch to v1 extraction, sanitize LLM response, improve prompt |
| `787825f` | test(intelligence): update context-mappers assertion for organizationId |
| `b6d529e` | fix lint errors |
| `4376778` | feat(intelligence): complete Phase 5 pipeline integration, orgId context, and robust V2 owner resolution |
| `b26c57a` | Merged PR 605: feat(intelligence): add KG extraction and V2 insight extraction capabilities |
| `1700fe2` | Merged PR 603: Add RAG to the chat feature |
| `ab8e5b6` | fix linting errors |
| `bf14ed9` | Merged PR 602: add graph LLM config and knowledge graph tools for LLM agent |
| `f8e16a9` | feat(intelligence): add InsightsExtractionCapabilityV2 |
| `6f1a33c` | feat(intelligence): add KnowledgeGraphExtractionCapability |
| `b834da0` | fix lint errors |
| `69ac0ed` | add graph llm config and add graph search tools |
| `7524875` | Merged PR 601: Add entity, relationship, and insight suggestion storage layer |
| `d8e9f61` | fix lint errors |
| `3041d2b` | add storage and db schema |

### New Capabilities

**Knowledge Graph Extraction** (`src/intelligence/capabilities/knowledge-graph-extraction/`) — New `ICapability` implementation:
- `KnowledgeGraphExtractionCapability` — Agentic KG extraction using tool-calling LLM chain
- Analyzes messages and maintains enterprise knowledge graph via tool calls
- Entity types: `Person`, `Team`, `Project`, `Service`, `Repository`, `Document`, `Ticket`, `Channel`
- Relationship types: `WORKS_ON`, `OWNS`, `DEPENDS_ON`, `REFERENCES`, `BELONGS_TO`, `MENTIONS`
- Configurable retries (`LLM_MAX_RETRIES`) and max iterations (`LLM_MAX_TOOL_ITERATIONS`)
- Uses `GraphToolsService` for graph operations

**Insight Extraction V2** (`src/intelligence/capabilities/insights-extraction-v2/`) — New `ICapability` implementation:
- `InsightExtractionCapabilityV2` — Extracts insights using Knowledge Graph tools for disambiguation
- Integrates KG tools (`search_graph`, `get_entity`, `get_neighbors`) for owner resolution
- Enhanced batch owner resolution: exact platformUserId match → exact username match → fuzzy Levenshtein against PlatformUserMapping user names → exact/fuzzy match against Organization users
- Supports `excludeAuthor`, `broadcasted`, `priority`, `deadline` fields
- Configurable retries and max tool iterations

**Suggestions Capability** (`src/intelligence/capabilities/suggestions/`) — New `ICapability` implementation:
- `SuggestionsCapability` — Generates action options with KG context for decision makers
- Analyzes extracted insights with KG context to produce context summaries and action options (Option A, B, C)
- Action types: `RECOMMENDATION`, `RISK_MITIGATION`, `NEXT_STEP`, `REASSIGN`, `ESCALATE`, `DELEGATE`, `DISMISS`
- Persists suggestions to `insight_suggestions` table
- Skips extraction when no insights are in context (no-op for empty pipelines)

### New REST API — Suggestions (`src/intelligence/suggestions/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/suggestions` | JWT | Get AI suggestions for the authenticated user (optional `?status=` filter) |
| GET | `/suggestions/insight/:insightId` | JWT | Get or auto-generate AI suggestions for a specific insight |
| POST | `/suggestions/generate/:insightId` | JWT | Trigger on-demand AI suggestion generation for an insight |
| PATCH | `/suggestions/:id/status` | JWT | Update suggestion status (ACCEPTED/DISMISSED/COMPLETED) |

**`SuggestionsService`** (`src/intelligence/suggestions/suggestions.service.ts`):
- `getUserSuggestions(userId, organizationId?, status?)` — List suggestions for user (filtered by owned or broadcasted insights)
- `getInsightSuggestions(insightId, organizationId?)` — Get suggestions for specific insight
- `getOrGenerateForInsight(insightId, userId, organizationId?)` — Returns existing or auto-generates on first access
- `generateForInsight(insightId, userId, organizationId?)` — Creates synthetic chunk and invokes `suggestions-extractor` capability
- `updateStatus(id, status)` — Updates status; on ACCEPTED/COMPLETED, resets peer suggestions to PENDING

**DTOs:**
- `UpdateSuggestionStatusDto` — `{ status: SuggestionStatus }` (validated enum)

### RAG for Chat (`src/chat/`, `src/intelligence/embeddings/`)

**pgvector support** (`prisma/app-db/migrations/20260729000000_add_pgvector/`):
- New migration: enables `vector` extension, adds `embedding vector(1536)` column to `insight_versions`
- IVFFlat index with `vector_cosine_ops` for approximate nearest neighbor search
- `db/init/002-enable-pgvector.sql` — Init script for PostgreSQL vector extension

**`EmbeddingService`** (`src/intelligence/embeddings/embedding.service.ts`) — NEW:
- `onModuleInit()` — Initializes embedder based on config
- `embed(text)` — Embed single query string
- `embedDocuments(texts)` — Embed batch of documents
- Supported providers: `openai` (default, `text-embedding-3-small`), `ollama` (`nomic-embed-text`), `google-genai` (`text-embedding-004`)
- Config via `embeddings.*` namespace (provider, model, dimensions, apiKey, baseUrl)

**`EmbeddingRepository`** (`src/repositories/embedding.repository.ts`) — NEW:
- `upsert(insightVersionId, embedding)` — Raw SQL UPDATE for `vector` column
- `searchSimilar(embedding, limit, userId?, minSimilarity?)` — Cosine distance search via `<=>` operator with IVFFlat index; joins against latest version and optional user ownership filter; supports fallback threshold
- `findByFilters(userId, limit, filters)` — Structured filter query (by type/status) without embedding; returns results with `similarity = 1.0`
- `deleteByInsightVersionId(insightVersionId)` — Clear embedding

**`ChatContextService`** (`src/chat/chat-context.service.ts`) — REFACTORED:
- `buildContext(userId, userMessage?)` — Builds RAG context string from semantically relevant insights
- Hybrid retrieval: structured filter (when type/status keywords detected in query) + semantic search (always runs)
- Fallback chain: semantic search at 0.65 threshold → fallback to 0.45 → recent insights when nothing matches
- Formats insights with type, status, priority, source, deadline (OVERDUE/DUE TODAY/in N days), creation date
- TYPE_KEYWORDS map: info/information → INFO, task/tasks → TASK, urgency/urgent/urgencies → URGENCY, decision/decisions → DECISION
- STATUS_KEYWORDS map: pending, done, blocked, noted, in review, decided, delegated, delayed, hidden

**`ChatService.streamResponse()`** — REFACTORED:
- Now calls `chatContextService.buildContext(userId, userMessage)` before LLM streaming
- Context prepended as `## Current Date` + `## Relevant Insights` sections to system prompt
- Messages saved after streaming completes (prevents orphaned user messages on failure)
- Includes `AbortSignal` support for SSE cancellation

**`ChatController.sendMessage()`** — REFACTORED:
- Streams SSE with `{type: 'token', content: '...'}`, `{type: 'done'}`, `{type: 'error', message: '...'}`
- Handles connection close (aborts LLM, breaks stream loop)

**Insight Persistence** (`src/intelligence/store/insight-persistence.service.ts`) — REFACTORED:
- `persistAll()` now auto-generates embeddings for persisted insights after DB write
- Calls `embeddingService.embedDocuments()` and `embeddingRepository.upsert()` for each new/updated version

**Embeddings Module** (`src/intelligence/embeddings/embeddings.module.ts`) — NEW:
- Exports `EmbeddingService`

**Chat Module** (`src/chat/chat.module.ts`) — UPDATED:
- Imports `EmbeddingsModule` (for `ChatContextService`)

### Knowledge Graph Storage Layer

**`EntityRepository`** (`src/repositories/entity.repository.ts`) — NEW:
- `create(data)` — Create entity with orgId, name, type, metadata
- `upsert(data)` — Case-insensitive find by (orgId, name, type), merge metadata on conflict; returns existing or creates
- `findById(id)` — Find by UUID (validates UUID format)
- `findByNameAndType(organizationId, name, type)` — Case-insensitive lookup
- `search(organizationId, query, type?, limit?)` — Case-insensitive name contains search, optional type filter
- `update(id, data)` — Update name/type/metadata
- `delete(id)` — Delete by UUID

**`RelationshipRepository`** (`src/repositories/relationship.repository.ts`) — NEW:
- `create(data)` — Create with orgId, sourceEntityId, targetEntityId, type, metadata
- `upsert(data)` — Upsert on composite unique `(sourceEntityId, targetEntityId, type)`
- `findById(id)` — Find with sourceEntity and targetEntity included
- `findBySourceOrTarget(entityId)` — Find all relationships involving an entity
- `getNeighbors(entityId, maxDepth?)` — BFS traversal returning `GraphNeighborhood` (rootEntity, entities[], relationships[])
- `delete(id)` — Delete by UUID

**`InsightSuggestionRepository`** (`src/repositories/insight-suggestion.repository.ts`) — NEW:
- `create(data)` — Create suggestion with insightId, title, description, actionType, reasoning, status, metadata
- `createMany(records)` — Batch create, returns count
- `findById(id)` — Find with insight + latest version included
- `findByInsightId(insightId)` — Find all for an insight, ordered by createdAt asc
- `findByOrganizationId(organizationId, options?)` — Find by org with status filter, includes insight + latest version
- `findByUser(userId, organizationId?, options?)` — Find suggestions for user's owned or broadcasted insights
- `updateStatus(id, status)` — Update suggestion status
- `deleteByInsightId(insightId)`, `delete(id)` — Delete operations

**`UserRepository`** (`src/repositories/user.repository.ts`) — UPDATED:
- Added `findByOrganization(organizationId)` — Find all users in an org (used by V2 owner resolution)

**`RepositoriesModule`** (`src/repositories/repositories.module.ts`) — UPDATED:
- Added `EmbeddingRepository`, `EntityRepository`, `RelationshipRepository`, `InsightSuggestionRepository`

### Knowledge Graph Tools (`src/intelligence/tools/`)

**`GraphToolsService`** (`src/intelligence/tools/graph-tools.service.ts`) — NEW:
- `getTools(organizationId?)` — Returns 6 `StructuredTool` instances for LLM agent tool-calling:
  - `search_graph` — Search entities by name/keyword, optional type filter
  - `get_entity` — Get entity detail + relationships by ID
  - `get_neighbors` — BFS neighborhood traversal up to configurable depth (`GRAPH_MAX_NEIGHBOR_DEPTH`, default 2)
  - `create_entities` — Batch create/merge entities
  - `update_entities` — Batch update entities
  - `create_relationships` — Batch create/upsert relationships
- Uses `EntityRepository` and `RelationshipRepository` for persistence

**`ToolsModule`** (`src/intelligence/tools/tools.module.ts`) — NEW:
- Imports `RepositoriesModule`, exports `GraphToolsService`

### LLM Service (`src/intelligence/llm/`)

**`LlmService`** (`src/intelligence/llm/llm.service.ts`) — UPDATED:
- `createGraphLLM()` — NEW: Creates a dedicated LLM for graph operations with separate config (`llm.graphProvider`, `llm.graphModel`, `llm.graphApiKey`, `llm.graphBaseUrl`); falls back to main LLM config when graph-specific config absent
- `createToolChain(config)` — NEW: Creates multi-iteration tool-calling chain (`RunnableLambda`):
  - Binds tools to LLM via `.bindTools()`
  - Iterates up to `maxIterations` (default 3): invokes model, checks `tool_calls`, executes tools via `ToolMessage`, repeats
  - Returns LLM content when no more tool calls
  - Throws on iteration limit exceeded
- `createStreamingLLM()` — NEW: Creates model with `streaming: true` for token-by-token chat responses
- `createToolModel(tools)` — NEW: Binds tools to LLM and returns `Runnable`

**`LlmService` spec** (`src/intelligence/llm/llm.service.spec.ts`) — NEW (60 lines):
- Tests: missing config validation, error propagation, streaming for openai/ollama/openrouter, bindTools, tool chain execution, graph-specific config fallback

**`LlmTypes`** (`src/intelligence/llm/llm.types.ts`) — NEW:
- `ToolCallingChainConfig` — `{ tools, systemPrompt?, maxIterations?, model? }`
- `ToolChainInput` — `{ messages: BaseMessage[] }`

### Capabilities Module — REFACTORED

**`CapabilitiesModule`** (`src/intelligence/capabilities/capabilities.module.ts`) — REFACTORED:
- Imports: `InsightsExtractionModule`, `KnowledgeGraphExtractionModule`, `InsightsExtractionV2Module`, `SuggestionsCapabilityModule`, `MergeModule`
- Registers 4 capabilities in order: `kgService` → `insightService` (V1) → `insightV2Service` → `suggestionsService`
- Exports: `CapabilityManager`, `MergeModule`, `KnowledgeGraphExtractionModule`, `InsightsExtractionV2Module`, `SuggestionsCapabilityModule`

### Intelligence Engine — REFACTORED

**`IntelligenceEngineService`** (`src/intelligence/intelligence-engine.service.ts`) — REFACTORED:
- Pipeline now executes KG extraction first (non-fatal, errors logged + recorded as capability failures), then V2 insight extraction
- Both capabilities called by name via `capabilityManager.executeByName()`
- `Insights Extraction V1` removed from main pipeline; V2 is the primary
- Envelope status: `READY` on successful V2 extraction, `FAILED` on error
- Previous V1 `InsightExtractionCapability` remains registered but no longer called in `executeRun()`

**`IntelligenceModule`** (`src/intelligence/intelligence.module.ts`) — UPDATED:
- Imports `ToolsModule`, `SuggestionsModule`
- Exports `SuggestionsModule`

### Database Schema — App DB (`prisma/app-db/schema.prisma`)

**New Models:**
- `Entity` — `{ id, organizationId, name, type, metadata (JSON?), createdAt, updatedAt }`. Indexes on `organizationId`, `type`, `name`, composite `(organizationId, type, name)`.
- `Relationship` — `{ id, organizationId, sourceEntityId, targetEntityId, type, metadata (JSON?), createdAt, updatedAt }`. Composite unique `(sourceEntityId, targetEntityId, type)`. Cascade delete on both entity relations.
- `InsightSuggestion` — `{ id, insightId (FK→Insight), organizationId, title, description, actionType, reasoning?, status, metadata, createdAt, updatedAt }`. Indexes on `insightId`, `organizationId`, `status`.

**New Enums:**
- `SuggestionActionType`: `RECOMMENDATION`, `RISK_MITIGATION`, `NEXT_STEP`, `REASSIGN`, `ESCALATE`, `DELEGATE`, `DISMISS`
- `SuggestionStatus`: `PENDING`, `ACCEPTED`, `DISMISSED`, `COMPLETED`

**Modified Models:**
- `InsightVersion` — Added `embedding vector(1536)?` column (via pgvector extension)
- `Insight` — Added `suggestions InsightSuggestion[]` relation

### Configuration Changes

**New config namespace:**
- `embeddings.config.ts` — `embeddings.*`: `provider` (default `openai`), `model` (`text-embedding-3-small`), `dimensions` (`1536`), `apiKey` (falls back to `LLM_API_KEY`), `baseUrl` (`http://localhost:11434`)

**App Module** (`src/app.module.ts`) — UPDATED:
- Imports `embeddingsConfig` in `ConfigModule.forRoot({ load: [...] })`
- Now 13 config namespaces (added `embeddingsConfig`)

**New env vars (`.env.example`):**
- `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`
- `LLM_MAX_RETRIES=3`, `OWNER_RESOLVER_MAX_DISTANCE=3`

**Docker Compose** (`docker-compose.yml`) — UPDATED:
- Extended PostgreSQL command with `postgres:16-alpine` healthcheck

**New init script:**
- `db/init/002-enable-pgvector.sql` — `CREATE EXTENSION IF NOT EXISTS vector`

### Test Coverage (New Spec Files)

| File | Lines | Coverage |
|------|-------|----------|
| `src/intelligence/llm/llm.service.spec.ts` | 60 | LlmService (graphLLM, streaming, tool chain, config validation) |
| `src/intelligence/capabilities/knowledge-graph-extraction/knowledge-graph-extraction.capability.spec.ts` | 81 | KG extraction capability |
| `src/intelligence/capabilities/insights-extraction-v2/insight-extraction-v2.capability.spec.ts` | 119 | V2 insight extraction capability |
| `src/intelligence/capabilities/suggestions/suggestions.capability.spec.ts` | 113 | Suggestions capability |
| `src/intelligence/suggestions/suggestions.controller.spec.ts` | 65 | Suggestions REST controller |
| `src/intelligence/suggestions/suggestions.service.spec.ts` | 89 | Suggestions service (CRUD, on-demand generation) |
| `src/intelligence/tools/graph-tools.service.spec.ts` | 148 | GraphToolsService tool definitions |
| `src/repositories/entity.repository.spec.ts` | 136 | EntityRepository CRUD |
| `src/repositories/relationship.repository.spec.ts` | 116 | RelationshipRepository CRUD + BFS |
| `src/repositories/insight-suggestion.repository.spec.ts` | 78 | InsightSuggestionRepository |

**Updated Spec Files:**
- `src/chat/chat-context.service.spec.ts` (359 lines, +294) — RAG context building with embedding service
- `src/chat/chat.service.spec.ts` (205 lines, +82) — SSE streaming, abort signal, context-aware responses
- `src/intelligence/intelligence-engine.service.spec.ts` (565 lines, restructured) — Updated for V2 pipeline, KG extraction
- `src/intelligence/context/utils/context-mappers.spec.ts` (+1 line) — organizationId assertion
- `src/ingestion/plugins/services/plugin-context.service.spec.ts` (+8 lines) — Minor updates

### V1 Extraction Prompt (`src/intelligence/capabilities/insights-extraction/`) — UPDATED
- `insight-extraction-prompt.ts` — Added `excludeAuthor` field, reinforced priority/deadline extraction, sanitized JSON output instructions (no markdown fences)
- `insight-extraction.capability.ts` — Now uses `resolveOwnersBatch()` for batch owner resolution (same logic as V2)
- `types/index.ts` — Added `InputMessage` interface (shared with V2)

### Minor Changes

- `src/auth/auth.service.ts` — Added `organizationId` to JWT payload
- `src/auth/strategies/jwt.strategy.ts` — Returns `organizationId` in validated user
- `package.json` — Updated, `pnpm-lock.yaml` updated (37 lines changed)

### Files Changed (71)

```
 .env.example                                       |   9 +
 db/init/002-enable-pgvector.sql                    |   2 +
 docker-compose.yml                                 |   2 +-
 package.json                                       |   1 +
 pnpm-lock.yaml                                     |  37 +
 prisma/app-db/backfill-embeddings.ts               |  72 +
 .../20260729000000_add_pgvector/migration.sql      |  12 +
 prisma/app-db/schema.prisma                        | 124 +-
 prisma/app-db/seed.ts                              |   9 +-
 src/app.module.ts                                  |   2 +
 src/auth/auth.service.ts                           |  13 +
 src/auth/strategies/jwt.strategy.ts                |   2 +
 src/chat/chat-context.service.spec.ts              | 359 +-
 src/chat/chat-context.service.ts                   | 229 +-
 src/chat/chat.controller.ts                        |  61 +-
 src/chat/chat.module.ts                            |   9 +-
 src/chat/chat.service.spec.ts                      | 205 +-
 src/chat/chat.service.ts                           | 123 +-
 src/chat/dto/send-message.dto.ts                   |   5 +-
 src/config/embeddings.config.ts                    |   9 +
 .../services/plugin-context.service.spec.ts        |   8 +
 .../plugins/services/plugin-context.service.ts     |  11 +-
 .../capabilities/capabilities.module.ts            |  41 +-
 .../insight-extraction-v2-prompt.ts                |  46 +
 .../insight-extraction-v2.capability.spec.ts       | 119 +
 .../insight-extraction-v2.capability.ts            | 432 +
 .../insights-extraction-v2.module.ts               |  12 +
 .../insight-extraction-prompt.ts                   |  10 +-
 .../insight-extraction.capability.ts               |  15 +-
 .../insights-extraction/types/index.ts             |   1 +
 .../kg-extraction-prompt.ts                        |  17 +
 .../kg-extraction-schema.ts                        |  47 +
 .../knowledge-graph-extraction.capability.spec.ts  |  81 +
 .../knowledge-graph-extraction.capability.ts       |  92 +
 .../knowledge-graph-extraction.module.ts           |  11 +
 .../capabilities/suggestions/suggestions-prompt.ts |  44 +
 .../capabilities/suggestions/suggestions-schema.ts |  35 +
 .../suggestions/suggestions.capability.module.ts   |  12 +
 .../suggestions/suggestions.capability.spec.ts     | 113 +
 .../suggestions/suggestions.capability.ts          | 189 +
 .../context/utils/context-mappers.spec.ts          |   1 +
 src/intelligence/context/utils/context-mappers.ts  |   1 +
 src/intelligence/embeddings/embedding.service.ts   |  78 +
 src/intelligence/embeddings/embeddings.module.ts   |   8 +
 .../intelligence-engine.service.spec.ts            | 565 +-
 src/intelligence/intelligence-engine.service.ts    |  73 +-
 src/intelligence/intelligence.module.ts            |   9 +-
 src/intelligence/llm/llm.service.spec.ts           |  60 +
 src/intelligence/llm/llm.service.ts                |  46 +-
 src/intelligence/llm/llm.types.ts                  |   2 +
 .../store/insight-persistence.service.ts           |  43 +-
 src/intelligence/store/store.module.ts             |   3 +-
 .../dto/update-suggestion-status.dto.ts            |  13 +
 .../suggestions/suggestions.controller.spec.ts     |  65 +
 .../suggestions/suggestions.controller.ts          | 106 +
 src/intelligence/suggestions/suggestions.module.ts |  13 +
 .../suggestions/suggestions.service.spec.ts        |  89 +
 .../suggestions/suggestions.service.ts             | 159 +
 src/intelligence/tools/graph-tools.service.spec.ts | 148 +
 src/intelligence/tools/graph-tools.service.ts      | 213 +
 src/intelligence/tools/tools.module.ts             |   5 +-
 src/repositories/embedding.repository.ts           | 203 +
 src/repositories/entity.repository.spec.ts         | 136 +
 src/repositories/entity.repository.ts              | 152 +
 .../insight-suggestion.repository.spec.ts          |  78 +
 src/repositories/insight-suggestion.repository.ts  | 158 +
 src/repositories/insight.repository.ts             |  20 +-
 src/repositories/relationship.repository.spec.ts   | 116 +
 src/repositories/relationship.repository.ts        | 163 +
 src/repositories/repositories.module.ts            |  12 +
 src/repositories/user.repository.ts                |   7 +
 71 files changed, 4695 insertions(+), 671 deletions(-)
```

**Stats:** 71 files changed, 4695 insertions(+), 671 deletions(-)

---

## 2026-07-29 — Commit `2b039ab`

*excludeAuthor ownership control, new user background processing, test coverage for ingestion services.*

### Commits (3 new, 250 total)

| Hash | Message |
|------|---------|
| `2b039ab` | Merged PR 600: #993 feat: add excludeAuthor ownership control and new user background processing |
| `4af26ac` | Merged PR 597: test(ingestion): add unit test coverage for ingestion services |
| `13f73d8` | Merged PR 594: feat(ingestion): plugin activation lifecycle with per-chat workers and infrastructure abstraction |

### New Events & Listeners

**`UserSignedUpEvent`** (`src/auth/events/user-signed-up.event.ts`) — Simple DTO class:
- `userId: string`, `firstName: string`, `lastName: string | null`, `email: string`

**`SignupListener`** (`src/auth/listeners/signup.listener.ts`) — `@OnEvent('user.signed.up')` handler:
- `assignBroadcastedInsights(userId)` — Assigns all latest broadcasted insights to newly signed-up user (deduplicates existing assignments)
- `resolveUnresolvedOwners(event)` — Fuzzy-matches the user's name (first, last, firstName+lastName, lastName+firstName) against all `UnresolvedOwner` records with a `platformUsername`, using Levenshtein distance (`OWNER_RESOLVER_MAX_DISTANCE`, default 1). Creates `InsightVersionOwner` records for matches and deletes the resolved `UnresolvedOwner` records.

**`AuthService`** (`src/auth/auth.service.ts`):
- Emits `user.signed.up` event via `EventEmitter2` after both email signup and OAuth user creation
- Injects `EventEmitter2` as `eventEmitter`

**`AuthModule`** (`src/auth/auth.module.ts`):
- Imports `RepositoriesModule` (for `UnresolvedOwnerRepository`)
- Registers `SignupListener` as provider

### excludeAuthor Ownership Control

**LLM Extraction Prompt** (`src/intelligence/capabilities/insights-extraction/insight-extraction-prompt.ts`):
- Added `excludeAuthor` field to system prompt instructions:
  - `true` when message author is delegating or asking others to take action (e.g. "could someone do X?", "Bob, can you do X?")
  - `false` when author is self-committing or insight is general information
  - Default is `false`
- When `excludeAuthor: true` and `broadcasted: true` — shown to everyone except the author
- When `excludeAuthor: true` and specific owners are assigned — only those owners (excluding author) see it

**LLM Schema** (`src/intelligence/capabilities/insights-extraction/insight-schema.ts`):
- Added `excludeAuthor: z.boolean().optional()` to both `UpdatedInsightSchema` and `NewInsightSchema`

**Insight Extraction Capability** (`src/intelligence/capabilities/insights-extraction/insight-extraction.capability.ts`):
- Added `excludeAuthor` processing in the capability:
  - `getExcludedUserIds(envolopsRef)` — Resolves platform author IDs to app user IDs via `platformToAppUser` map
  - Filters excluded user IDs from resolved owners list
  - Auto-sets `broadcasted: true` when all owners are excluded
  - Attaches `excludedUserIds` to the Insight object

**Insight Repository** (`src/repositories/insight.repository.ts`):
- `create()` and `update()` now handle `excludedUserIds`:
  - When `broadcasted: true` and `excludedUserIds` present — creates owners for all users except excluded (instead of broadcasting)
  - When `broadcasted: true` without exclusions — creates owners for all users (unchanged)

**Insight Types** (`src/types/insight.types.ts`):
- Added `excludedUserIds?: string[]` to `Insight` interface

**Insight Persistence** (`src/intelligence/store/insight-persistence.service.ts`):
- Passes `excludedUserIds` from Insight object to repository `create()` and `update()` calls

### Owner Resolution Improvements

**PlatformUserMappingRepository** (`src/repositories/platform-user-mapping.repository.ts`):
- Added `findWithUser(pluginName)` — Returns mappings joined with user (firstName, lastName) for fuzzy matching
- Added `resolveUnresolvedOwners(platformUserId, platformUsername, pluginName, appUserId)` — Private method called after `create()` and `upsert()` to automatically match unresolved owners by platformUserId or platformUsername, creating `InsightVersionOwner` records and deleting resolved `UnresolvedOwner` records

**UnresolvedOwnerRepository** (`src/repositories/unresolved-owner.repository.ts`):
- Full CRUD expanded from previous 3 methods:
  - `create(data)` — Create single unresolved owner
  - `createMany(data)` — Batch create unresolved owners
  - `findByInsightVersionId(id)` — Find by version
  - `findByPluginName(name)` — Find by plugin
  - `findAllWithUsername()` — Find all with non-null platformUsername (used by SignupListener)
  - `findByPlatformUserId(platformUserId, pluginName)` — Find by platform user
  - `findByPlatformUsername(platformUsername, pluginName)` — Find by platform username
  - `deleteByInsightVersionId(id)` — Delete all for a version
  - `delete(id)` — Delete single
  - `deleteMany(ids)` — Batch delete

### Test Coverage (New Spec Files)

| File | Lines | Coverage |
|------|-------|----------|
| `src/ingestion/plugins/common/base-plugin-provider.spec.ts` | 88 | BasePluginProvider abstract class validation |
| `src/ingestion/plugins/providers/telegram/utils/telegram-utils.spec.ts` | 69 | Telegram utility functions |
| `src/ingestion/plugins/services/plugin-config.service.spec.ts` | 134 | PluginConfigService CRUD and event publishing |
| `src/ingestion/plugins/utils/provider-utils.spec.ts` | 138 | Provider utility functions |
| `src/ingestion/workers/batch-buffer.service.spec.ts` | 53 | BatchBuffer flush logic |

### Minor Fixes

- **InsightPriorityQueryDto** (`src/insights/dto/insight-priority-query.dto.ts`):
  - Added `@Type(() => Number)` decorator for class-transformer transformation
- **InsightsController** (`src/insights/insights.controller.ts`):
  - `updatePriority()` now uses `new ValidationPipe({ transform: true })` to ensure query param is transformed from string to number

### Files Changed (19)

```
 src/auth/auth.module.ts                            |   4 +
 src/auth/auth.service.ts                           |  23 +++
 src/auth/events/user-signed-up.event.ts            |   8 +
 src/auth/listeners/signup.listener.ts              | 164 +++++++++++++++++++++
 .../plugins/common/base-plugin-provider.spec.ts    |  88 +++++++++++
 .../telegram/utils/telegram-utils.spec.ts          |  69 ++++++++-
 .../plugins/services/plugin-config.service.spec.ts | 134 +++++++++++++++++
 src/ingestion/plugins/utils/provider-utils.spec.ts | 138 +++++++++++++++++
 src/ingestion/workers/batch-buffer.service.spec.ts |  53 +++++++
 src/insights/dto/insight-priority-query.dto.ts     |   2 +
 src/insights/insights.controller.ts                |   3 +-
 .../insight-extraction-prompt.ts                   |  27 ++--
 .../insight-extraction.capability.ts               |  75 ++++++++--
 .../insights-extraction/insight-schema.ts          |   2 +
 .../store/insight-persistence.service.ts           |   2 +
 src/repositories/insight.repository.ts             |  32 +++-
 .../platform-user-mapping.repository.ts            |  68 ++++++++-
 src/repositories/unresolved-owner.repository.ts    |  37 +++++
 src/types/insight.types.ts                         |   1 +
 19 files changed, 900 insertions(+), 30 deletions(-)
```

**Stats:** 19 files changed, 900 insertions(+), 30 deletions(-)

---

## 2026-07-28 — Commit `21bd9b7`

*Infrastructure abstraction layer, insight priority/deadline, plugin config service, provider extraction, lint cleanup.*

### Commits (11 new, 247 total)

| Hash | Message |
|------|---------|
| `21bd9b7` | fix(lint): resolve require-await, unused vars, and unsafe type lint issues |
| `dede88c` | fix(test): update spec mocks for insight priority and enum type assertions |
| `e299715` | Merge branch 'HA_976_major_refactor' into HA_976 |
| `c0433fc` | Merge branch 'main' of ... into HA_976 |
| `9e15ad7` | refactor(config): extract global ingestion config and add plugin override resolver |
| `2b8c9f1` | perf(ingestion): optimize backfill completion event to query pending DB envelopes |
| `1d52c48` | refactor(config): move flushIntervalMs to telegram config and remove obsolete streaming config |
| `8df60f6` | refactor(ingestion): split monolithic services and enable dynamic worker syncing |
| `8eb500f` | refactor(ingestion): abstract infrastructure providers and add base plugin class |
| `65b13ff` | Merged PR 592: feat(insights): add priority/deadline to DTOs and PATCH priority endpoint |
| `2982e63` | Merged PR 591: #993 feat(insights): extract priority/deadline from LLM and compute deadline-based boost |
| `c7dc33a` | Merged PR 589: #993 feat(insights): add priority and deadline columns to schema |

### New Modules

**Common Providers (`src/common/providers/`)** — Abstract infrastructure interfaces with in-memory implementations:
- `IEventBus` (`event-bus/`) — `publish(event, payload)`, `subscribe(event, handler)`; backed by NestJS `EventEmitter2`
- `ILockManager` (`lock-manager/`) — `acquire(key, ownerId, ttlMs?)`, `release(key, ownerId)`, `isLocked(key)`; `InMemoryLockManager` uses `Map<string, LockEntry>`
- `ICacheStore` (`cache-store/`) — `get<T>(key)`, `set<T>(key, value, ttlMs?)`, `delete(key)`; `InMemoryCacheStore` uses `Map<string, CacheEntry>`
- `CommonProvidersModule` — Global module, wires all three via DI tokens (`EVENT_BUS_TOKEN`, `LOCK_MANAGER_TOKEN`, `CACHE_STORE_TOKEN`)

**Workers (`src/ingestion/workers/`)** — Refactored from `src/ingestion/plugins/services/`:
- `IngestionWorker` — Per-chat worker, concurrent backfill + stream with individual `AbortController`, `BatchBuffer` for DB flushing, publishes `envelopes.ingested` events
- `WorkerManager` — Manages workers, subscribes to `plugin.activated` / `plugin.deactivated` / `plugin.config.updated` events, dynamic worker syncing on config changes, imports `LOCK_MANAGER_TOKEN` instead of direct `RedisService`
- `WorkerRecoveryService` — Handles session expiry recovery, sets status to `ERROR` and restarts workers
- `WorkersModule` — New module, exports `WorkerManager`
- `BatchBuffer` — Moved from `src/ingestion/streaming/` to `src/ingestion/workers/`

**Plugin Config Service (`src/ingestion/plugins/services/`)** — Extracted from `PluginManagerService`:
- `PluginConfigService` — `getConfig`, `getSanitizedConfig`, `createConfig`, `updateConfig`, `deleteConfig`, `disconnect`, `login`; publishes `plugin.config.updated` events

### New/Modified Interfaces & Types

**`BaseProviderConfig`** (`src/ingestion/plugins/interfaces/provider-config.interface.ts`) — `{ chats: ProviderChatEntry[], [key: string]: unknown }`
- `ProviderChatEntry` — `{ id, name, historyLimit? }`
- `ConfigFieldSchema` — `{ key, label, type: 'text'|'number'|'password'|'checkbox-list', required, placeholder?, description? }`
- `ActivationRequirementResult` — `{ field, message, met }`

**`BasePluginProvider`** (`src/ingestion/plugins/common/base-plugin-provider.ts`) — Abstract class implementing `IPlugin`:
- `parseConfig(raw)` — Returns typed `TConfig`
- `validateAuth(sessionString, context)` — Calls `validateAuthImpl`
- `isConnected(config?, context?)` — Calls `isConnectedImpl`
- Abstract `validateAuthImpl`, `isConnectedImpl` to be implemented by providers

**`IPlugin`** (`src/ingestion/plugins/interfaces/plugin.interface.ts`) — Now generic: `IPlugin<TConfig extends BaseProviderConfig>`:
- `parseConfig?(raw: Record<string, unknown>): TConfig` — Optional typed config parser
- `getConfigSchema?(): ConfigFieldSchema[]` — Returns field definitions for dynamic UI
- `getActivationRequirements?(config): ActivationRequirement[]` — Returns validation rules
- `startStream` now includes `cursor?: number` in `StreamOpts`

**Provider utils** (`src/ingestion/plugins/utils/provider-utils.ts`):
- `extractProviderChats(config)` — Safely extracts `ProviderChatEntry[]` from raw config
- `isSessionExpired(err)` — Detects Telegram session expiry errors
- `maskSecret(secret)` — Masks secrets for safe display
- `resolvePluginConfig<T>(configService, pluginName, key, defaultValue, aliasKey?)` — Plugin-specific config with global fallback

### New Plugin Controller Endpoints

**`PluginsController`** (`src/ingestion/plugins/plugins.controller.ts`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/plugins/:name/config-schema` | JWT | Get config schema for rendering dynamic forms |
| GET | `/plugins/:name/activation-requirements` | JWT | Get activation requirements and whether they are met |
| GET | `/plugins/:name/status` | JWT | Get plugin activation status with per-chat worker state |

Also added `PluginUpdateChatsDto` — `{ chats: ChatItemDto[] }` with `ChatItemDto` (`id`, `name`, `historyLimit?`).

### Insight Priority & Deadline

**Database (app-db):**
- New migration `20260728000000_add_priority_and_deadline` — Adds `deadline` (TIMESTAMP) to `insight_versions`, `priority` (INTEGER) to `insight_version_owners`

**DTOs:**
- `InsightPriorityQueryDto` — `priority: number` (1-10, validated `@IsInt` `@Min(1)` `@Max(10)`)
- `InsightDetailResponseDto.priority?: number` — Priority score (1-10)
- `InsightDetailResponseDto.deadline?: Date` — Deadline for time-sensitive insights
- `InsightResponseDto.priority?: number` — Priority in version list
- `InsightResponseDto.deadline?: Date` — Deadline in version list

**Controller:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/insights/:id/priority?priority=N` | JWT | Override priority on an insight |

**Service:**
- `InsightsService.updatePriority(id, userId, priority)` — Finds insight, gets latest version, upserts priority via `InsightActionRepository.upsertPriority()`

**Repository:**
- `InsightActionRepository.upsertPriority(insightVersionId, userId, priority)` — UPSERT priority on `insight_version_owners`
- `InsightRepository` — All queries now include `priority` and `deadline` in results

### Modifications

**Config changes:**
- `ingestion.config.ts` — Added `backfillMode: 'last'`, `backfillBatchSize: 100`, `dbBatchSize: 10`, `dbBatchWindowMs: 5000`, `providerStreamFlushIntervalMs: 5000`
- `telegram.config.ts` — Moved `backfillMode` and `backfillBatchSize` to `ingestion` namespace; added `backfillOffsetId: 1`; removed streaming-specific fields
- `engine.config.ts` — Added `insightDeadlineWarningDays: 3`
- **Removed** `redis.config.ts` — Replaced by `CommonProvidersModule` abstraction
- **Removed** `streaming.config.ts` — Config folded into `ingestion` namespace
- **Removed** `RedisModule` / `RedisService` — Replaced by `ILockManager` and `IEventBus` abstractions

**App module (`src/app.module.ts`):**
- Removed: `PluginsModule`, `TelegramPluginModule`, `RedisModule`, `redisConfig`, `streamingConfig`
- Added: `CommonProvidersModule`

**Ingestion module (`src/ingestion/ingestion.module.ts`):**
- Added `WorkersModule`, `PluginConfigService`, `PluginUpdateChatsDto`
- Refactored plugin imports to match new `providers/` directory

**Plugins module (`src/ingestion/plugins/plugins.module.ts`):**
- Imports `WorkersModule` instead of old worker services
- Registers `PluginConfigService`, exports `PluginConfigService`

**Telegram plugin:**
- Moved from `src/ingestion/plugins/telegram/` → `src/ingestion/plugins/providers/telegram/`
- Old monolithic `telegram-plugin.service.ts` removed; split into:
  - `TelegramBackfillService` — Extracted backfill logic
  - `TelegramStreamService` — Extracted streaming logic
  - `TelegramPluginService` — Orchestrates both, implements `IPlugin`, uses `BasePluginProvider` pattern
- Added `parseConfig()` returning `TelegramConfig` typed object
- `TelegramClientFactory` — Creates GramJS client with DC IP override for production connectivity

**Intelligence engine (`src/intelligence/intelligence-engine.service.ts`):**
- New `@OnEvent('envelopes.ingested')` handler — `handleEnvelopesIngested()` triggers `run()` with appropriate envelope scoping and progress tracking
- Insight extraction prompt updated to include `priority` (1-10) and `deadline` (ISO 8601) fields; prompt now includes current date for deadline calculation
- `InsightSchema` updated with `priority: z.number().int().min(1).max(10).nullish()` and `deadline: z.string().nullable()`

**Insight persistence (`src/intelligence/store/insight-persistence.service.ts`):**
- Passes `priority` and `deadline` to Prisma create/update calls

**Envelope repository (`src/repositories/envelope.repository.ts`):**
- Refactored queries: `findRecentGrouped` added, `findByPluginAndChat` added, `createManyWithPayload` uses `organizationId`

**ActiveChatListenerRepository:**
- Minor reformatting, no functional change

**InsightRepository:**
- `findByOwnerId()` returns `priority` and `deadline`
- `findVersionsByInsightId()` returns `priority` and `deadline`
- `findVersionById()` returns `priority` and `deadline`
- `mapToInsight()` maps `deadline` from version

**Docker compose:**
- Added `redis:7-alpine` service with healthcheck

### Infrastructure

- `.gitignore` — Added `graphify-out/`
- Lint fixes across 17+ files (unused vars, require-await, unsafe member access)

### Files Changed (75)

```
 .gitignore                                         |   1 +
 docker-compose.yml                                 |  12 +
 prisma/app-db/migrations/20260728000000_add_priority_and_deadline/migration.sql |   5 +
 prisma/app-db/schema.prisma                        |  10 +-
 src/app.module.ts                                  |  12 +-
 src/chat/chat-context.service.spec.ts              |  65 ++--
 src/common/providers/cache-store/cache-store.interface.ts |   7 +
 src/common/providers/cache-store/in-memory-cache-store.service.ts |  35 ++
 src/common/providers/common-providers.module.ts    |  27 ++
 src/common/providers/event-bus/event-bus.interface.ts |   9 +
 src/common/providers/event-bus/in-memory-event-bus.service.ts |  26 ++
 src/common/providers/lock-manager/in-memory-lock-manager.service.ts |  54 +++
 src/common/providers/lock-manager/lock-manager.interface.ts |   7 +
 src/config/engine.config.ts                        |   4 +
 src/config/ingestion.config.ts                     |   5 +
 src/config/redis.config.ts                         |   8 -
 src/config/telegram.config.ts                      |   4 +-
 src/ingestion/events/ingestion.events.ts           |  36 ++
 src/ingestion/ingestion.module.ts                  |  15 +-
 src/ingestion/plugins/common/base-plugin-provider.ts |  70 ++++
 src/ingestion/plugins/dto/plugin-update-chats.dto.ts |  41 +++
 src/ingestion/plugins/interfaces/plugin.interface.ts |  20 +-
 src/ingestion/plugins/interfaces/provider-config.interface.ts |  27 ++
 src/ingestion/plugins/plugins.controller.ts        | 103 +++++-
 src/ingestion/plugins/plugins.module.ts            |  22 +-
 src/ingestion/plugins/providers/telegram/services/telegram-backfill.service.ts | 162 +++++++++
 src/ingestion/plugins/providers/telegram/services/telegram-client.factory.ts |   8 +-
 src/ingestion/plugins/providers/telegram/services/telegram-plugin.service.ts | 214 ++++++++++++
 src/ingestion/plugins/providers/telegram/services/telegram-stream.service.ts |  94 ++++++
 src/ingestion/plugins/providers/telegram/telegram-plugin.module.ts |  13 +-
 src/ingestion/plugins/services/ingestion-worker.service.ts | 143 --------
 src/ingestion/plugins/services/plugin-activation.service.ts | 156 +++++----
 src/ingestion/plugins/services/plugin-config.service.ts | 125 +++++++
 src/ingestion/plugins/services/plugin-context.service.ts |   9 +-
 src/ingestion/plugins/services/plugin-manager.service.spec.ts |  20 ++
 src/ingestion/plugins/services/plugin-manager.service.ts |  77 ++---
 src/ingestion/plugins/services/worker-manager.service.ts | 212 ------------
 src/ingestion/plugins/telegram/services/telegram-plugin.service.ts | 363 ---------------------
 src/ingestion/plugins/types/worker-state.type.ts   |   1 +
 src/ingestion/plugins/utils/provider-utils.ts      |  73 +++++
 src/ingestion/redis/redis.module.ts                |   9 -
 src/ingestion/redis/redis.service.ts               | 110 -------
 src/ingestion/streaming/streaming.config.ts        |   7 -
 src/ingestion/workers/batch-buffer.service.ts      |  18 +-
 src/ingestion/workers/ingestion-worker.service.ts  | 178 ++++++++++
 src/ingestion/workers/worker-manager.service.ts    | 243 ++++++++++++++
 src/ingestion/workers/worker-recovery.service.ts   |  64 ++++
 src/ingestion/workers/workers.module.ts            |  19 ++
 src/insights/dto/insight-detail-response.dto.ts    |  12 +
 src/insights/dto/insight-priority-query.dto.ts     |  15 +
 src/insights/dto/insight-response.dto.ts           |  12 +
 src/insights/insights.controller.spec.ts           | 120 +++++++
 src/insights/insights.controller.ts                |  18 +
 src/insights/insights.service.spec.ts              | 263 +++++++++++++++
 src/insights/insights.service.ts                   |  33 ++
 src/intelligence/capabilities/insights-extraction/insight-extraction-prompt.ts |  19 +-
 src/intelligence/capabilities/insights-extraction/insight-extraction.capability.ts |   8 +-
 src/intelligence/capabilities/insights-extraction/insight-schema.ts |   4 +
 src/intelligence/intelligence-engine.service.ts    |  19 ++
 src/intelligence/store/insight-persistence.service.ts |   4 +
 src/repositories/active-chat-listener.repository.ts |   6 +-
 src/repositories/envelope.repository.ts            |  94 +++---
 src/repositories/insight-action.repository.ts      |  23 ++
 src/repositories/insight.repository.ts             | 114 ++++++-
 src/types/insight.types.ts                         |   2 +
 75 files changed, 2610 insertions(+), 1125 deletions(-)
```

**Stats:** 75 files changed, 2610 insertions(+), 1125 deletions(-)

---

## 2026-07-28 — Commit `cb070ff`

*Plugin activation lifecycle, Redis multi-instance coordination, worker system, Chat API endpoints.*

### Commits (9 new, 236 total)

| Hash | Message |
|------|---------|
| `cb070ff` | feat(infra): add Redis-based multi-instance coordination for WorkerManager |
| `d74f5c4` | feat(intelligence): add backfill intelligence trigger, ingestion config, remove skipChunking |
| `78fe9c4` | refactor(ingestion): remove old ingestion/streaming code, simplify IPlugin and Telegram plugin |
| `0d99b5b` | feat(api): add POST activate/deactivate and GET status endpoints to PluginsController |
| `0853d60` | feat(ingestion): add PluginActivationService, WorkerManager, IngestionWorker, BatchBuffer, ActiveChatListenerRepository, update IPlugin interface |
| `ab66a60` | feat(db): add PluginStatus enum, status columns to plugin_configs, and ActiveChatListener model |
| `fa771a4` | Merged PR 588: Create Chat API Endpoints |
| `87f54ee` | Merged PR 587: feat(ingestion): add streaming controller and event listener for real-time chat ingestion |

### New Modules

**Plugin Activation (`src/ingestion/plugins/services/`)** — Full lifecycle management:
- `PluginActivationService` — Activates/deactivates plugins, spawns per-chat workers
- `WorkerManager` — Manages `IngestionWorker` instances with Redis distributed lock coordination, startup recovery, shutdown cleanup
- `IngestionWorker` — Per-chat worker running concurrent backfill + stream phases, triggers backfill intelligence on completion
- Worker state tracking via `WorkerState` type (`backfill: IDLE|RUNNING|COMPLETED`, `stream: IDLE|LISTENING|STOPPED`)

**Redis (`src/ingestion/redis/`)** — Distributed coordination infrastructure:
- `RedisService` — Distributed locks (SET NX PX), heartbeats, pub/sub
- `RedisModule` — Global module, exported `RedisService`
- Config: `REDIS_URL`, key prefix, heartbeat interval, claim timeout

**Chat API (`src/chat/`)** — HTTP endpoints for chat:
- `ChatController` — `GET /api/chat/messages` (history), `POST /api/chat/messages` (SSE streaming)
- Now publicly accessible (previously private module with no controller)

**Database changes (app-db):**
- `PluginStatus` enum: `NOT_CONNECTED | CONNECTED | CONFIGURED | ACTIVATING | ACTIVE | DEACTIVATING | ERROR`
- `PluginConfig.status`, `activatedAt`, `errorMessage` columns added
- `ActiveChatListener` model: tracks per-chat listeners with `subscriberCount`, `claimedBy`, `heartbeatAt`, `ownerUserId`

### Deleted Modules

- **`IngestionController`** (`src/ingestion/ingestion.controller.ts`) — Removed; backfill flow now handled by plugin activation
- **`IngestionService`** (`src/ingestion/services/ingestion.service.ts`) — Removed
- **`IngestionRunnerService`** (`src/ingestion/services/ingestion-runner.service.ts`) — Removed
- **`StreamingOrchestratorService`** (`src/ingestion/streaming/streaming-orchestrator.service.ts`) — Replaced by `IngestionWorker` + `WorkerManager`
- **`StreamingEventListener`** (`src/ingestion/streaming/streaming-event.listener.ts`) — Removed
- **`StreamingController`** (`src/ingestion/streaming/streaming.controller.ts`) — Removed
- **`StreamingModule`** (`src/ingestion/streaming/streaming.module.ts`) — Empty; only `StreamingResumeService` remains
- **`BackfillJobEvents`** (`src/ingestion/events/backfill-job.events.ts`) — Removed

### Functional Changes

**Plugin interface** — `IPlugin` simplified:
- `backfill()` accepts optional `AbortSignal`
- `stopStream()` removed (callers use `AbortSignal`)
- Added `getConfigSchema()` and `getActivationRequirements()` for dynamic UI
- `startStream()` no longer manages its own `AbortController` (uses caller-provided signal)

**Telegram plugin** — Removed `streamControllers` map and internal `AbortController` management; uses caller-provided signal

**Intelligence engine** — Removed `skipChunking` option and `streamingPreviousInsightLimit` config; all runs go through chunking pipeline

**Config** — Added `ingestion` namespace (`backfillDayThreshold: 60`) and `redis` namespace (`url`, `keyPrefix`, `heartbeatIntervalMs`, `claimTimeoutMs`)

**ActiveChatListenerRepository** — New repository for subscribing/unsubscribing chat listeners with claimed-by tracking, heartbeat updates, distributed lock support

**EnvelopeRepository** — Added `findRecentGrouped` method (not externally visible)

### Dependencies

- Added `ioredis` and `@types/ioredis`

### Files Changed (40)

```
 .env.example                                       |   5 +
 package.json                                       |   2 +
 pnpm-lock.yaml                                     |  68 +
 prisma/app-db/migrations/.../migration.sql         |  24 +
 prisma/app-db/migrations/.../migration.sql         |   3 +
 prisma/app-db/migrations/migration_lock.toml       |   3 +
 prisma/app-db/schema.prisma                        |  49 +-
 src/app.module.ts                                  |   8 +-
 src/chat/chat.controller.ts                        |  66 +
 src/chat/chat.module.ts                            |   6 +-
 src/config/ingestion.config.ts                     |   5 +
 src/config/redis.config.ts                         |   8 +
 src/ingestion/events/backfill-job.events.ts        |  30 -
 src/ingestion/ingestion.controller.ts              |  69 -
 src/ingestion/ingestion.module.ts                  |  18 +-
 src/ingestion/plugins/interfaces/plugin.interface.ts   |  10 +-
 src/ingestion/plugins/plugins.controller.ts        |  42 +-
 src/ingestion/plugins/plugins.module.ts            |  11 +-
 src/ingestion/plugins/services/ingestion-worker.service.ts   | 143 +
 src/ingestion/plugins/services/plugin-activation.service.ts  | 184 +
 src/ingestion/plugins/services/plugin-manager.service.spec.ts |   2 +-
 src/ingestion/plugins/services/worker-manager.service.ts     | 212 +
 src/ingestion/plugins/telegram/services/telegram-plugin.service.ts |  33 +-
 src/ingestion/plugins/types/worker-state.type.ts   |   6 +
 src/ingestion/redis/redis.module.ts                |   9 +
 src/ingestion/redis/redis.service.ts               | 110 +
 src/ingestion/services/ingestion-runner.service.ts | 160 -
 src/ingestion/services/ingestion.service.spec.ts   | 151 -
 src/ingestion/services/ingestion.service.ts        |  92 -
 src/ingestion/streaming/batch-buffer.service.ts    |  31 +
 src/ingestion/streaming/streaming-event.listener.ts |  83 -
 src/ingestion/streaming/streaming-orchestrator.service.ts | 256 -
 src/ingestion/streaming/streaming-resume.service.ts |  31 -
 src/ingestion/streaming/streaming.controller.ts    |  79 -
 src/ingestion/streaming/streaming.module.ts        |  14 -
 src/intelligence/intelligence-engine.service.ts    | 132 +-
 src/repositories/active-chat-listener.repository.ts | 131 +
 src/repositories/envelope.repository.ts            |  12 +-
 src/repositories/plugin-config.repository.ts       |  23 +-
 src/repositories/repositories.module.ts            |   3 +-
```

**Stats:** 40 files changed, 1161 insertions(+), 1163 deletions(-)

---

## 2026-07-25 — Commit `ef90f38`

*Chat module, streaming ingestion, jobs tracking, profile endpoint, CI pipeline.*

### Commits (40 new, 227 total)

(see previous entry)
