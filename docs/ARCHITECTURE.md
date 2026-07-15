# pn-console-api Architecture

> High-level and detailed architecture of the PN Console backend API (NestJS 11, Prisma 6, PostgreSQL 16).
> Serves the **pn-console-app** (Tauri Desktop UI).
>
> **Keep this file in sync with the codebase.** Update it whenever you add a module, change a data flow, modify the API surface, or introduce a new design principle. New user stories go in `user_stories/<number>.md`.

---

## 1. Overview

PN Console is a **unified data ingestion platform** designed to aggregate messages and content from various external sources (starting with Telegram) into a standardized, queryable internal format called an `Envelope`.

The architecture follows a **plugin-based, modular design** to ensure extensibility. An intelligence engine layer extracts structured insights from ingested data via a deterministic orchestration pipeline. Core tenets include:

- **Not multi-tenant.** `organizationId` fields throughout the pipeline are for logical grouping / routing only — no tenant isolation, no per-tenant secrets or data sharding.
- **Plugin-First Extensibility:** New data sources are added as plugins without modifying core business logic or API routes.
- **Separation of Concerns:** Plugin lifecycle management, data transformation, and data persistence are decoupled.
- **Standardized Data Model:** All incoming data is normalized into a common `Envelope` + `MessagePayload` schema, regardless of its origin.
- **Stateless Core, Stateful Plugins:** The backend remains stateless; plugin-specific authentication and session states are managed locally by the plugins themselves.

---

## 2. System Context (C4 Model)

```
+---------------------------------------------------------------+
|                     External Systems                           |
|  +---------------------+    +-----------------------------+    |
|  |   Telegram API      |    |   PostgreSQL 16             |    |
|  |   (GramJS)          |    |   ├── np_console_raw_db    |    |
|  |                     |    |   └── np_console_app_db    |    |
|  +----------+----------+    +-----------------------------+    |
|             |                                                  |
+-------------+--------------------------------------------------+
              |
+-------------+--------------------------------------------------+
|             v                                                  |
|  +----------------------------------------------------------+ |
|  |               PN Console API (NestJS 11)                  | |
|  |                                                           | |
|  |  +----------+  +----------+  +----------+  +----------+  | |
|  |  |  Plugin  |  |Ingestion |  |Intelligence|  | Envelope|  | |
|  |  |  Manager |  | Service  |  |  Engine   |  | Service |  | |
|  |  +-----+----+  +-----+----+  +-----+----+  +----+----+  | |
|  |        |             |             |             |        | |
|  |        v             v             v             v        | |
|  |  [Telegram Plugin]   | [LlmService] [RawDbService]      |  |
|  |  [...Future Plugins] | [AppDbService]                    |  | |
|  |  [...Future Plugins] |      [Capabilities]               | |
|  +----------------------------------------------------------+ |
|                        |                                       |
|                        v                                       |
|              +------------------+                              |
|              |  pn-console-app  |                              |
|              |  (Tauri Desktop) |                              |
|              +------------------+                              |
+----------------------------------------------------------------+
```

---

## 3. Module-Level Architecture

The application is logically divided into three concentric layers:

1.  **Presentation Layer (API):** Handles HTTP requests, input validation, and serialization.
2.  **Service Layer (Business Logic):** Manages plugins lifecycle, ingestion pipeline, and intelligence extraction.
3.  **Data Layer (Persistence):** Handles database interactions and internal file storage.

```
+------------------------------------------------------------------+
|                       PRESENTATION LAYER                          |
|  +-----------------+  +-----------------------------------+      |
|  | AppController   |  | PluginsController                 |      |
|  | GET /api/health |  | GET    /api/plugins               |      |
|  |                 |  | POST   /api/plugins/:name/...     |      |
|  |                 |  | POST   /api/plugins/:name/action  |      |
|  +-----------------+  +-----------------------------------+      |
|  +------------------------+  +------------------------------+     |
|  | IngestionController    |  |                             |     |
|  | POST /api/ingestion/   |  | (no HTTP controller —       |     |
|  |         backfill       |  |  event-driven only)         |     |
|  +------------------------+  +------------------------------+     |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                        SERVICE LAYER                              |
|  +---------------------+  +-----------------------------------+  |
|  | PluginManager       |  | IntelligenceEngineService         |  |
|  | (Lifecycle)         |  | (Orchestrator)                    |  |
|  +---------------------+  +-----------------------------------+  |
|  +---------------------+  +-----------------------------------+  |
|  | IngestionService    |  | EnterpriseContextBuilder          |  |
|  | (backfill pipeline) |  | ChunkingPipeline                  |  |
|  +---------------------+  | CapabilityManager                |  |
|  +---------------------+  | InsightPersistenceService        |  |
|  | IPlugin impls       |  +-----------------------------------+  |
|  | TelegramPlugin      |  +-----------------------------------+  |
|  | ...Future Plugins   |  | LlmService (LangChain wrapper)   |  |
|  +---------------------+  +-----------------------------------+  |
|  +---------------------+                                         |
|  | Demo Components     |                                         |
|  | (manual testing)    |                                         |
|  +---------------------+                                         |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                          DATA LAYER                               |
|  +-----------------+  +-----------------------------------+      |
|  | PrismaService   |  | EnvelopeService                   |      |
|  | (Connection)    |  | (ORM Operations)                  |      |
|  +-----------------+  +-----------------------------------+      |
|  +---------------------+  +-----------------------------------+  |
|  | Repositories        |  | JSON File System (Plugin State)   |  |
|  | (InsightRepo,       |  | ~/.pn-console/plugins/<name>/     |  |
|  |  PlatformUserRepo)  |  |   sessions.json                   |  |
|  +---------------------+  |   topic-map.json                  |  |
|                           |   pending-auth.json               |  |
|                           +-----------------------------------+  |
|  +-----------------------------------+                          |
|  | InsightPersistenceService        |                          |
|  +-----------------------------------+                          |
+------------------------------------------------------------------+
```

---

## 4. Detailed Component Design

### 4.1 Plugin System

The core extensibility mechanism. Defined by the `IPlugin` contract.

#### 4.1.1 Plugin Lifecycle State Machine

Plugins managed by the `PluginManagerService` transition through a strict state machine to prevent invalid operations (e.g., streaming before logging in).

```
[CREATED]
   |
   | initialize(config)
   v
[INITIALIZED]
   |
   | login(credentials)
   v
[LOGGED_IN]
   |
   | startStream()
   v
[STREAMING]
   |
   | stopStream()
   v
[STOPPED]
   |
   | logout()
   v
[INITIALIZED]
```

**States:**
- `CREATED`: Plugin instantiated but not configured.
- `INITIALIZED`: Plugin initialized with config.
- `LOGGED_IN`: Plugin authenticated.
- `STREAMING`: Plugin actively streaming real-time data.
- `STOPPED`: Stream paused/stopped.
- `ERROR`: Plugin encountered a non-recoverable error.

#### 4.1.2 Plugin Interface (`IPlugin`)

```typescript
interface IPlugin {
  name: string;
  /**
   * Setup plugin with initial configuration.
   */
  initialize(config): Promise<void>;

  /**
   * Authenticate the plugin with the external service.
   * Returns: ok | need_code | need_password
   */
  login(credentials): Promise<PluginLoginResult>;

  /**
   * Tear down authentication and sessions.
   */
  logout(): Promise<void>;

  /**
   * Fetch historical data.
   */
  backfill(limit: number): AsyncIterable<EnvelopeWithPayload[]>;

  /**
   * Fetch real-time data stream.
   */
  startStream(signal?): AsyncIterable<EnvelopeWithPayload[]>;

  /**
   * Stop real-time data stream.
   */
  stopStream(): void;

  /**
   * Generic action handler for plugin-specific operations (e.g., submit-2fa-code).
   */
  handleAction(action, params): Promise<unknown>;
}
```

### 4.2 Intelligence Engine

The intelligence engine extracts structured knowledge items (tasks, decisions, urgency, info) from ingested envelopes via a deterministic orchestration pipeline.

#### 4.2.1 Engine Architecture

```
IntelligenceEngineService.run(orgId, opts?)
  │
  ├── contextBuilder.build(orgId)         ← O(1), no DB queries
  │   ↓
  ├── ctx.previousIntelligence({})        ← collect all existing insights
  │   ↓
  ├── ctx.envelopes({ ids?, windowStart?, windowEnd? })
  │   │   ← lazy AsyncIterable<EnvelopeWithPayload[]>
  │   ↓
  └── for each envelope batch:
      ├── pipeline.run(batch)             ← chunk into DataChunk[]
      │   ↓
      └── for each chunk:
          ├── capabilityManager.executeAll({ chunk, previousIntelligence })
          │   ↓
          └── persistence.persistAll(insights)

EnterpriseContext (immutable, lazy)
  ├── previousIntelligence({ maxItems?, windowStart?, windowEnd? })
  │     ← AsyncIterable<Insight[]>
  └── envelopes({ ids?, windowStart?, windowEnd?, maxBatchSize? })
        ← AsyncIterable<EnvelopeWithPayload[]>
```

The orchestration is currently manual (programmatic `run()` call). An event-driven trigger (`EnvelopesIngestedListener`) exists but is short-circuited by a `return` statement — activate by removing it when auto-trigger on backfill is desired.

#### 4.2.2 LLM Layer

The `LlmService` wraps LangChain's `initChatModel()` for provider-agnostic LLM access. Capabilities call the LLM directly through `LlmService` (their own DI concern).

Supported providers: Anthropic, OpenAI, Ollama (configured via `LLM_PROVIDER` env var).

#### 4.2.3 Capability Pattern

Every capability follows the same lifecycle:
1. Receive `CapabilityInput` (`DataChunk` + pre-resolved `Insight[]`)
2. Serialize context into a structured prompt
3. Call `LlmService.complete()` with strict JSON output instruction (LLM is the capability's own DI concern)
4. Parse and validate JSON response
5. Map to `CapabilityResult.insights[]` for persistence

The `CapabilityManager` aggregates all capabilities via the `CAPABILITY` DI token (`multi: true`). Provides `executeAll` (fans out via `Promise.allSettled`, collects errors per-capability) and `executeByName` (throws `NotFoundException` if missing).

### 4.3 Data Flow & Ingestion Pipeline

#### 4.3.1 Backfill Flow

Triggered manually via `POST /api/ingestion/backfill`.

```
[Tauri App]          [IngestionController] [PluginManager]   [TelegramPluginService]
|                    [PluginsController]
     |                       |                   |                     |
     | POST /initialize      |                   |                     |
     |---------------------->|                   |                     |
     |                       | initPlugin()      |                     |
     |                       |------------------>|                     |
     |                       |                   | initialize(config)  |
     |                       |                   |-------------------->|
     |                       |                   |    State: INIT      |
     |                       |<------------------|                     |
     |<----------------------|                   |                     |
     |                       |                   |                     |
     | POST /login           |                   |                     |
     |---------------------->|                   |                     |
     |                       | loginPlugin()     |                     |
     |                       |------------------>|                     |
     |                       |                   | login(creds)        |
     |                       |                   |-------------------->|
     |                       |                   | {status: need_code} |
     |                       |<------------------|                     |
     | {status: need_code}   |                   |                     |
     |<----------------------|                   |                     |
     |                       |                   |                     |
     | POST /action (submit) |                   |                     |
     |---------------------->|                   |                     |
     |                       | handleAction()    |                     |
     |                       |------------------>|                     |
     |                       |                   | handleAction(...)   |
     |                       |                   |-------------------->|
     |                       |                   | {status: ok}        |
     |                       |                   | Set State: LOGGED_IN  |
     |                       |<------------------|                     |
     |        200 OK         |                   |                     |
     |<----------------------|                   |                     |
     |                       |                   |                     |
     |     [IngestionController] [IngestionService] [EnvelopeService] [PostgreSQL]
     |                       |                   |                     |
      | POST /backfill        |                   |                     |
      |---------------------->|                   |                     |
      |                       | ingest({          |                     |
      |                       |   plugins,        |                     |
      |                       |   limit,          |                     |
      |                       |   organizationId, |                     |
      |                       |   triggeredBy     |                     |
      |                       | })                |                     |
      |                       |------------------>|                     |
      |                       |                   |                     |
      |                       | for each plugin:  |                     |
      |                       | get(name)         |                     |
      |                       | (from PM)         |                     |
      |                       |<------------------|                     |
      |                       |                   |                     |
      |                       | backfill(limit)   |                     |
      |                       | (AsyncIterable)   |                     |
      |                       |------------------>|                     |
      |                       |                   | GramJS API Calls    |
      |                       |                   |                     |
      |                       | yield Envelope[]  |                     |
      |                       |<------------------|                     |
      |                       |                   |                     |
      |                       | bulkCreate(dto, { |                     |
      |                       |   organizationId  |                     |
      |                       | })                |                     |
      |                       |------------------>|                     |
      |                       |                   | Chunked $tx (500)   |
      |                       |                   | per-item create     |
      |                       |                   | P2002 dedup         |
      |                       |                   |-------------------->|
      |                       |                   |                     |
      |                       |<------------------|                     |
      |                       |                   |                     |
      |    {inserted: count}  |                   |                     |
      |<----------------------|                   |                     |
```

#### 4.3.2 Data Normalization

All incoming data must be normalized into the universal `Envelope` + `Payload` structure within the plugin's `backfill` or `startStream` methods.

```typescript
// Normalized Envelope and Payload Structure
{
  sourcePlugin: 'telegram',           // Identifies origin
  sourceId: '12345',                  // Unique ID from the source API
  type: 'message',
  hasAttachment: false,
  authorId: 'user_42',
  occurredAt: new Date('2026-07-07T10:00:00Z'),
  organizationId?: 'org-123',         // Logical grouping, not tenant isolation
  status?: 'pending' | 'ready' | 'failed', // Ingestion status
  permissions?: Record<string, unknown>,   // Access control metadata
  payload: {
    type: 'direct',                     // Enum: direct, email
    content: 'Hello World',
    groupId: 'chat_99',                // Optional: Group/Channel ID
    replyTo: '12344',                  // Optional: Reply to message ID
    topicId: '490',                    // Optional: Forum topic ID (e.g., Telegram)
    reactions: JSON.stringify({👍: 5}),  // JSON map of reactions
    pinned: false,
    editedDate: null,                  // Optional: Edit timestamp
    entities: JSON.stringify([{type: 'mention', ...}]), // Structured entities
    rawPayload: JSON.stringify({...originalApiObject}) // Full original data
  }
}
```

### 4.4 Database Schema

Managed by Prisma. The design is intentionally flexible to support rapid ingestion of varied payload types.

#### 4.4.1 Entity Relationship Diagram

```
+------------------------+       +------------------------+
|     ENVELOPE           |       |   MESSAGE_PAYLOAD      |
+------------------------+       +------------------------+
| PK  id                 |  1..N | PK  id                 |
|     sourcePlugin       |<------|     type               |
|     sourceId           |       |     content            |
|     type               |  1..1 |     groupId            |
| FK  payloadRef         |>------|     replyTo            |
|     hasAttachment      |       |     topicId            |
|     authorId           |       |     reactions          |
|     authorRef          |       |     pinned             |
|     organizationId     |       |     editedDate         |
|     occurredAt         |       |     entities           |
|     ingestedAt         |       |     rawPayload         |
|     status             |       +------------------------+
|     permissions        |
+------------------------+

Unique Constraint: (sourcePlugin, sourceId)
```

#### 4.4.2 Key Constraints & Design Decisions

- **`Envelope @@unique([sourcePlugin, sourceId])`:**
  Ensures idempotency. `IngestionService` safely skips duplicates on re-runs.

- **`MessagePayload.rawPayload`:**
  Preserves the entire original API response as JSON for future debugging, re-processing, or schema migration.

- **`Envelope.status`:**
  Supports future ingestion workflows (e.g., post-processing, enrichment, or indexing) before the data is marked as `ready`.

---

## 5. Technology Stack

| Category     | Technology                              |
|--------------|-----------------------------------------|
| Framework    | NestJS 11 (Node.js)                     |
| API Style    | REST (Swagger/OpenAPI via `/api/docs`)  |
| Databases    | PostgreSQL 16 (raw + app)                |
| ORM          | Prisma 6 (dual schema)                  |
| Language     | TypeScript 5.x (Target: ES2023)         |
| Package Mgr  | pnpm                                    |
| Testing      | Jest                                    |
| Auth          | Passport (Google OAuth, Microsoft OAuth, JWT bearer) |
| LLM Framework | LangChain (provider-agnostic)            |
| External API  | Telegram (GramJS)                       |
| Plugin State  | Local JSON Files (`~/.pn-console/plugins/`) |

---

## 6. Directory Structure

```
prisma/
├── raw-db/
│   └── schema.prisma       # Raw data DB: Envelope, MessagePayload (client → generated/raw-db-client)
├── app-db/
│   └── schema.prisma       # App data DB: Insight, InsightVersion (client → generated/app-db-client)

docs/
├── ARCHITECTURE.md         # This file
├── ingestion-improvements.md
├── intelligence-engine-implementation.md
└── module-restructure-plan.md

user_stories/
└── 844.md                  # Intelligence engine orchestration layer

src/
├── main.ts                 # Entry point: Swagger, CORS, Global prefix (/api)
├── app.module.ts           # Root NestJS module
├── app.controller.ts       # GET /api/health
│
├── prisma/
│   ├── prisma.module.ts    # Global PrismaModule (provides RawDbService + AppDbService)
│   ├── raw-db/
│   │   ├── raw-db.module.ts
│   │   ├── raw-db.service.ts      # PrismaClient for raw data DB
│   │   └── raw-db.service.spec.ts
│   └── app-db/
│       ├── app-db.module.ts
│       ├── app-db.service.ts       # PrismaClient for app DB
│       └── app-db.service.spec.ts
│
├── auth/                  # Authentication domain
│   ├── auth.module.ts
│   ├── auth.controller.ts # POST /api/auth/signup, GET /api/auth/{google,microsoft}[/callback]
│   ├── auth.service.ts    # Signup, loginOrCreate{Google,Microsoft}User
│   ├── dto/
│   │   └── signup.dto.ts
│   └── strategies/
│       ├── google.strategy.ts      # Passport Google OAuth
│       ├── microsoft.strategy.ts   # Passport Microsoft OAuth
│       └── jwt.strategy.ts         # Passport JWT verification
│
├── envelope/               # Shared lib (used by ingestion + intelligence)
│   ├── envelope.module.ts
│   ├── envelope.service.ts # Internal persistence (bulkCreate, findAll, count)
│   └── dto/
│       ├── create-envelope.dto.ts
│       ├── bulk-create-envelope.dto.ts
│       └── envelope-query.dto.ts
│
├── ingestion/              # Data source domain
│   ├── ingestion.module.ts
│   ├── ingestion.controller.ts # POST /api/ingestion/backfill
│   ├── ingestion.service.ts    # Orchestrates backfill pipeline
│   ├── types/
│   │   └── ingestion-options.type.ts  # IngestOptions interface
│   └── plugins/                # Plugin lifecycle & registry
│       ├── plugins.module.ts
│       ├── plugins.controller.ts    # Generic plugin HTTP API
│       ├── plugin-manager.service.ts # State machine & registry
│       ├── interfaces/
│       │   ├── plugin.interface.ts   # IPlugin contract
│       │   └── plugin-state.enum.ts  # PluginState enum
│       ├── dto/
│       │   ├── initialize-plugin.dto.ts
│       │   ├── login-plugin.dto.ts
│       │   └── action-plugin.dto.ts
│       ├── common/
│       │   ├── store.interface.ts    # IStore<T> contract
│       │   └── json-store.ts         # File-based implementation with atomic writes
│   └── telegram/
│           ├── telegram-plugin.module.ts
│           ├── telegram-plugin.service.ts   # IPlugin implementation for Telegram
│           ├── telegram-auth.service.ts     # 2FA, OTP codes, session management
│           ├── telegram-client.factory.ts   # GramJS client factory & destroyer
│           ├── telegram-session.store.ts    # Active session persistence
│           ├── telegram-topic.store.ts      # Topic ID mapping (messageId→topicId)
│           ├── pending-auth.store.ts        # Pending auth code/hash storage
│           ├── telegram.types.ts            # Telegram-specific interfaces
│           ├── telegram-utils.ts            # resolveTopicId, resolveEntities (stateless)
│           ├── normalizer.ts                # TelegramMessageRaw -> Envelope
│           └── dto/
│               └── submit-password.dto.ts
│
├── intelligence/           # Engine domain
│   ├── intelligence.module.ts
│   ├── intelligence-engine.service.ts      # Orchestrator
│   ├── intelligence-engine.service.spec.ts # 7 full pipeline tests
│   ├── context/
│   │   ├── enterprise-context.types.ts              # EnterpriseContext, RetrievalWindow, PreviousIntelligenceQuery
│   │   ├── enterprise-context-builder.abstract.ts   # Abstract builder — yields EnterpriseContext per window
│   │   ├── in-memory-enterprise-context-builder.ts  # Implementation: window loading + lazy previousIntelligence
│   │   ├── services/
│   │   │   └── window-discovery.service.ts           # PostgreSQL recursive CTE for window discovery
│   │   └── utils/
│   │       └── context-mappers.ts                    # DB row → domain type mappers
│   ├── chunking/             # Chunking pipeline
│   │   ├── __fixtures__/export.json                  # 1186-envelope real data fixture
│   │   ├── chunking.module.ts
│   │   ├── chunking-pipeline.service.ts
│   │   ├── chunking-strategy.interface.ts
│   │   ├── chunking.token.ts           # CHUNKING_STRATEGY DI token
│   │   ├── composite-chunking-strategy.ts   # 5-level pipeline orchestrator
│   │   ├── composite-chunking-strategy.spec.ts
│   │   ├── composite-chunking-strategy.intergration.spec.ts
│   │   ├── types/
│   │   │   └── data-chunk.type.ts
│   │   ├── partitioners/
│   │   │   ├── partitioner.interface.ts
│   │   │   ├── source-partitioner.ts
│   │   │   ├── group-id-partitioner.ts
│   │   │   ├── channel-id-partitioner.ts
│   │   │   ├── topic-id-partitioner.ts
│   │   │   └── daily-partitioner.ts
│   │   └── strategies/
│   │       ├── time-gap-chunk.strategy.ts
│   │       └── adaptive-chunk.strategy.ts
│   ├── capabilities/
│   │   ├── capabilities.module.ts
│   │   ├── capabilities.integration.spec.ts
│   │   ├── capability.interface.ts       # ICapability + CapabilityInput + CapabilityResult
│   │   ├── capability.token.ts           # CAPABILITY DI token
│   │   ├── capability-manager.service.ts # Registry + executeAll/executeByName
│   │   ├── capability-manager.service.spec.ts
│   │   └── insights-extraction/    # ICapability impl (LLM-based)
│   │       ├── insights-extraction.module.ts
│   │       ├── insight-extraction.capability.ts
│   │       ├── insight-extraction.capability.spec.ts
│   │       ├── insight-extraction-prompt.ts
│   │       ├── insight-schema.ts
│   │       └── types/
│   │           └── index.ts
│   ├── llm/
│   │   ├── llm.module.ts
│   │   ├── llm.service.ts      # LangChain wrapper
│   │   ├── llm.service.spec.ts
│   │   └── llm.types.ts
│   ├── store/
│   │   ├── store.module.ts
│   │   └── insight-persistence.service.ts     # persistAll — dispatches new vs updated insights
│   ├── merge/                # (placeholder — future insight merging)
│   │   └── merge.module.ts
│   ├── triggers/             # Event-driven triggers
│   │   ├── envelopes-ingested.event.ts       # Carries type, window/ids payload
│   │   └── envelopes-ingested.listener.ts    # Active: calls engine.run() after backfill
│
├── repositories/          # Data access layer for app DB
│   ├── repositories.module.ts
│   ├── insight.repository.ts                # CRUD + findByScope for scoped retrieval
│   └── platform-user-mapping.repository.ts   # Platform ↔ app user mapping
│
└── types/
    ├── envelope.types.ts    # EnvelopeData, MessagePayloadData (has topicId), EnvelopeWithPayload
    └── insight.types.ts     # InsightType, Insight
```

---

## 7. API Surface

### System
- `GET /api/health` : Database connectivity check.
- `GET /api/docs` : Swagger UI interactive documentation.

### Auth
- `POST /api/auth/signup` : Register a new user with email/password (bcrypt + JWT).
- `GET /api/auth/google` : Google OAuth login redirect.
- `GET /api/auth/google/callback` : Google OAuth callback, redirects to frontend with JWT.
- `GET /api/auth/microsoft` : Microsoft OAuth login redirect.
- `GET /api/auth/microsoft/callback` : Microsoft OAuth callback, redirects to frontend with JWT.
- `GET /api/auth/sso` : Generic SSO/OIDC login redirect.
- `GET /api/auth/sso/callback` : Generic SSO callback, redirects to frontend with JWT.

### Plugin Lifecycle (via PluginManager)
- `GET /api/plugins` : List all registered plugins and their current states.
- `GET /api/plugins/:name` : Get a single plugin's state.
- `POST /api/plugins/:name/initialize` : Initialize plugin with configuration `{ config }`.
- `POST /api/plugins/:name/login` : Authenticate plugin with credentials `{ credentials }`.
- `POST /api/plugins/:name/action` : Trigger a plugin-specific action with `{ action, params }`.
- `POST /api/plugins/:name/logout` : Logout and reset plugin state to `INITIALIZED`.
- `DELETE /api/plugins/:name` : Unregister and remove plugin from the manager.

### Data Ingestion (via IngestionService)
- `POST /api/ingestion/backfill` : Run a historical backfill for one or more plugins. Body: `{ plugin, limit }` (organizationId hardcoded to `'org-1'` until auth lands).

### Intelligence (programmatic API — no HTTP controller)
- `IntelligenceEngineService.run(orgId, opts?)` : Programmatic orchestration (available via DI). Accepts optional `envelopeIds`, `windowStart`, `windowEnd` filters. Auto-triggered by `EnvelopesIngestedListener` after each backfill completion.

### Demo (manual testing — bypasses full pipeline)
- `GET /api/demo/envelopes/count` : Count of envelopes in raw DB.
- `POST /api/demo/insights/generate` : Run LLM insight extraction on a single manual input (bypasses backfill + chunking).
- `POST /api/demo/insights/persist` : Persist a manually crafted insight to the app DB.
- `GET /api/demo/insights` : List all persisted insights from the app DB.

---

## 8. Key Design Principles & Decisions

### 8.1 Plugin Isolation
Plugins are strictly isolated. `PluginManager` only understands the `IPlugin` interface and `PluginState`. It has no knowledge of implementation details (e.g., GramJS) or data persistence. This enforces a clean boundary between the core system and external integrations.

*Verification: `PluginManager` has no import of `EnvelopeService` or `PrismaService`.*

### 8.2 Plugin-Owned Persistence
State that belongs to a plugin (e.g., Telegram sessions, auth tokens) is managed locally by that plugin via the `IStore<T>` interface using JSON files (`~/.pn-console/plugins/<name>/`). **There are no Prisma models for plugin state.** This prevents the core database schema from being polluted by plugin-specific structures.

### 8.3 Idempotent Ingestion
`IngestionService` calling `EnvelopeService.bulkCreate()` is safe to retry. Items are processed in chunks of 500 within a `$transaction`. On a `P2002` unique constraint violation (`@@unique([sourcePlugin, sourceId])`), the offending item is silently skipped — no per-item `findUnique` check needed. This eliminates the TOCTOU race and avoids an extra query per item.

### 8.4 Per-Call Client Lifecycle
To avoid session expiration and resource leaks, GramJS clients are created per function call (`Factory.create()`) and immediately destroyed (`Factory.destroy()`). The only exception is the multi-step authentication flow (code -> password), where the client is held in memory in `PendingAuth` state to ensure continuity and avoid `PHONE_CODE_EXPIRED` errors.

### 8.5 Provider-Agnostic LLM Layer
All LLM interactions go through LangChain's `initChatModel()`. The `LlmService` provides a universal factory that accepts `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY` env vars. Capabilities never import an SDK directly — they use `LlmService` (provider-agnostic LangChain wrapper). This keeps the system swappable between Anthropic, OpenAI, Ollama, or any LangChain-compatible provider.

### 8.6 Capability Isolation
Each intelligence capability is a self-contained `ICapability` implementation. Capabilities receive `CapabilityInput` (`DataChunk` + pre-resolved `Insight[]`) and return `CapabilityResult` (list of `Insight[]`). They own their LLM access via DI and are independently testable with mocked LLM responses.

### 8.7 Deterministic Chunking

Envelope batches are split into `DataChunk` units via a **5-level partitioner pipeline** composed by `CompositeChunkingStrategy`:

```
EnvelopeWithPayload[]
  → SourcePartitioner        (by sourcePlugin)
    → GroupIdPartitioner     (by payload.groupId)
      → ChannelIdPartitioner (by payload.channelId)
        → TopicIdPartitioner (by payload.topicId, fallback __null__)
          → DailyPartitioner  (by UTC day, size-aware merge)
            → DataChunk[]
```

**`DailyPartitioner`** is size-aware:
- If the group has < `minChunkMessages` (configurable, default 30), it returns a single group (no daily split)
- If ≥ threshold, it splits by UTC calendar day and merges adjacent small day-buckets (both sides < threshold) into one group
- This prevents 1-message or tiny chunks for sparse topics (e.g., daily announcements)

Each final partition group is emitted as a minimal chunk with a deterministic fingerprint `id` (e.g., `source:telegram/group-id:chat_99/channel-id:.../topic-id:2/daily:2026-07-13/minimal`).

No time-gap or recursive chunking is currently applied. The `TimeGapChunkStrategy` and `AdaptiveChunkStrategy` remain on disk for future use. `CompositeChunkingStrategy` is instantiated directly with `new` in the module factory — no DI needed. Chunking is independently testable and swappable.

### 8.8 IntelligenceEngineService Orchestration

`IntelligenceEngineService.run()` is the single entry point for the entire intelligence pipeline. It iterates windowed contexts (discovered by `WindowDiscoveryService` via PostgreSQL recursive CTE), chunks envelopes within each window, builds a targeted `PreviousIntelligenceQuery` from each chunk's first envelope metadata, retrieves previous insights lazily per chunk, fans out to capabilities, and persists results.

Key flow:
1. `contextBuilder.build(orgId, opts?)` yields one `EnterpriseContext` per retrieval window
2. For each window: `pipeline.run(ctx.envelopes)` chunks envelopes
3. For each chunk: `buildQuery(chunk)` creates a scoped query from chunk metadata
4. `ctx.previousIntelligence(query)` retrieves relevant past insights lazily
5. `capabilityManager.executeAll({ chunk, previousIntelligence })` extracts/updates insights
6. `persistence.persistAll(insights)` writes new insights and creates new versions for updates

Accepts optional `envelopeIds` (targeted reprocessing — skips window discovery, loads specific IDs), `windowStart`, and `windowEnd` filters. Exported from `IntelligenceModule`, available via DI anywhere the module is imported.

### 8.9 Event-Driven Intelligence Trigger

`IngestionService` emits an `envelopes.ingested` event after each backfill completion via `@nestjs/event-emitter` (global `EventEmitterModule`). The `EnvelopesIngestedEvent` carries a `type` discriminator (`backfill | stream`) and flexible payload:

- **Backfill:** `windowStart` + `windowEnd` (time range of collected data)
- **Stream (future):** `envelopeIds` (specific envelope IDs)

`EnvelopesIngestedListener` (registered in `IntelligenceModule`) is **active** — it catches the event and calls `IntelligenceEngineService.run()`. The engine is trigger-agnostic: it receives `{ envelopeIds?, windowStart?, windowEnd? }` and lets the context builder decide how to query envelopes. Errors are caught and logged; ingestion success is never affected by intelligence failures.

To disable auto-triggering, remove or comment out the `@OnEvent('envelopes.ingested')` decorator on the listener.

### 8.10 Window-Based Retrieval

Envelopes are processed in **retrieval windows** — groups of consecutive calendar days merged until a minimum message threshold (default 1000) is reached. Window discovery uses a **PostgreSQL recursive CTE** in `WindowDiscoveryService.discoverWindows()`:

```sql
WITH RECURSIVE daily AS (
    SELECT DATE(occurred_at) AS day, COUNT(*)::int AS cnt, ...
), windows AS (
    SELECT ...
    -- merge consecutive days until running_total >= minMessages
)
SELECT MIN(window_start), MAX(window_end), MAX(running_total)
FROM windows GROUP BY window_id;
```

Why per-chunk previous intelligence instead of per-window? Each chunk targets a specific scope (source plugin + channel/topic or group). Querying previous insights at the chunk level ensures the LLM gets only relevant context — avoiding noise from unrelated conversations in the same time window.
