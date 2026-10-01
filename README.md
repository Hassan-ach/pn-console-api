# PN Console API

NestJS 11 backend powering the **PN Console** desktop app (Tauri + Vue 3). Ingests messages from messaging platforms (Telegram), runs an LLM-driven **intelligence engine** that extracts enterprise insights and a knowledge graph, exposes RAG-based chat, and serves it all over a JWT-secured REST API.

- **HTTP:** `http://localhost:3000/api` (global `/api` prefix)
- **Swagger / OpenAPI:** `http://localhost:3000/api/docs`
- **Databases:** PostgreSQL 16 (two logical DBs) + Neo4j 5 (graph)

---

## Feature Overview

| Area | What it does |
|------|--------------|
| **Auth** | Email/password (bcrypt + JWT, token versioning for forced logout), OAuth via Google / Microsoft / generic OIDC (Keycloak), password reset with browser-relay flow for the desktop app. Global `JwtAuthGuard` with `@Public()` opt-out. |
| **Ingestion** | Pluggable `IPlugin` sources (Telegram today). Per-chat `IngestionWorker` runs **backfill** (cursor-based gap-fill) + **live stream** (batched, deduped). Distributed-style coordination via `ILockManager` so multiple instances don't double-ingest. |
| **Intelligence engine** | Event-driven pipeline: **context building → chunking → capability execution → persistence**. Capabilities: knowledge-graph extraction (direct structured extraction → Neo4j), insight extraction V2 (KG + search tools for disambiguation), suggestion generation. |
| **Insights** | Versioned business insights with per-owner action status (`PENDING → DONE` etc.), priority (1–10), deadlines, broadcast + `excludeAuthor` ownership semantics, fuzzy owner resolution (Levenshtein). |
| **Knowledge graph** | Neo4j graph of entities (Person, Team, Project, Service…) and relationships (WORKS_ON, DEPENDS_ON…), written by the KG capability, queried by the graph tools. Non-fatal when Neo4j is down. |
| **Chat** | Multi-conversation chat with SSE token streaming, 15s keepalive, abort on disconnect, auto-title, and **hybrid RAG context** (structured filters + vector similarity + recent-insights fallback) over pgvector embeddings. |
| **Suggestions** | LLM-generated action options (recommend, escalate, delegate, dismiss…) per insight, with a REST API to list/regenerate/update status. |
| **Jobs** | Event-driven job tracking for long-running intelligence runs (`PENDING → RUNNING → COMPLETED/FAILED`, progress, message). |
| **Demo endpoints** | Envelope count, on-demand insight extraction/persistence for testing without live ingestion. |

## Architecture

```
┌──────────────────┐   HTTP (JWT)   ┌─────────────────────────────────┐
│  pn-console-app  │ ─────────────► │  pn-console-api (NestJS, :3000) │
│  (Tauri + Vue 3) │                │  global prefix /api              │
└──────────────────┘                └─────────────────────────────────┘
```

Three independent stores (each with its own Prisma client where applicable):

| Store | Env var | Contents |
|-------|---------|----------|
| **Raw DB** (`prisma/raw-db/`) | `DATABASE_URL` | High-volume ingestion data: `envelope`, `message_payload`, `plugin_cursor`, `capability_failures` |
| **App DB** (`prisma/app-db/`) | `APP_DATABASE_URL` | Business data: users, insights + versions, owners, jobs, chat messages, conversations, plugin configs, platform user mappings, active listeners — plus pgvector embeddings |
| **Neo4j** | `NEO4J_URI` | Enterprise knowledge graph: entities, relationships (Cypher, MERGE semantics) |

The split keeps ingestion throughput isolated from app-level queries.

**Key design decisions**

1. **Plugin interface** — ingestion sources implement `IPlugin<TConfig>` (typed config parsing via `parseConfig()`) and register at startup via DI.
2. **Worker per chat** — each chat gets an `IngestionWorker` with its own `AbortController` for independent lifecycle (backfill → stream).
3. **Abstracted infrastructure** — `IEventBus`, `ILockManager`, `ICacheStore` interfaces with in-memory implementations (Redis was removed from the runtime path; swap back without touching consumers). Event names centralized in `Events` registry with typed `EventMap`; `subscribe()` supports retry/backoff.
4. **Event-driven lifecycle** — plugin activate/deactivate/config-update, ingestion, intelligence triggers, embeddings, and job tracking all flow through `IEventBus`, decoupling producers from workers.
5. **Capability pattern** — LLM extraction runs via pluggable `ICapability` implementations, executed sequentially (KG first, then insight extraction).
6. **Versioned insights** — every update creates a new `InsightVersion`; `priority`/`deadline` tracked per owner; embeddings generated asynchronously in the background (retry 3×, backoff, startup backfill).
7. **`organizationId` hardcoded to `'org-1'`** until multi-tenant auth lands.

**Core data flow** — activation → workers → intelligence:

```
POST /api/plugins/:name/activate
  → PluginActivationService → validate config + auth
  → publish 'plugin.activated' event
    → WorkerManager: for each chat, ILockManager.acquire() → IngestionWorker.run()
        ├─ backfill() (cursor-based, batched via BatchBuffer, saves cursor)
        └─ startStream() (live, batched) ─► publishes 'envelopes.ingested'
                                             → EnvelopesIngestedListener
                                               → IntelligenceEngineService.run()
                                                 → context build → chunking
                                                 → capabilities: KG → insights-v2 → suggestions
                                                 → persist + publish 'insight.versions.created'
                                                   → background embedding (pgvector)
```

Module graph, per-endpoint call flows, and the plugin state machine are documented in [`docs/architecture.md`](docs/architecture.md).

## Tech Stack

- **Runtime:** Node.js, TypeScript, NestJS 11, Express
- **Databases:** PostgreSQL 16 (Prisma 6), Neo4j 5 (neo4j-driver + LangChain `Neo4jGraph`), pgvector
- **LLM / AI:** LangChain (OpenAI, Anthropic, Google GenAI, xAI, DeepSeek, Ollama…), embeddings (OpenAI / Ollama / GenAI)
- **Auth:** Passport (JWT, Google OAuth 2.0, Microsoft, OpenID Connect), bcrypt
- **Other:** nodemailer + MailHog (dev SMTP), Swagger, Jest (unit/integration/e2e)

## Quick Start

**Prerequisites:** Node.js ≥ 20, pnpm, Docker (Postgres, Neo4j, Keycloak, MailHog).

```bash
# 1. Infrastructure (Postgres, Neo4j, Keycloak, MailHog, Redis for dev convenience)
docker compose up -d

# 2. Environment
cp .env.example .env
#    edit .env: set JWT_SECRET, DATABASE_URL, APP_DATABASE_URL, LLM_PROVIDER/LLM_MODEL/LLM_API_KEY

# 3. Database: push both schemas + pgvector init script
pnpm install
pnpm db:setup          # = prisma:push + prisma:generate + prisma:seed

# 4. Run
pnpm start:dev         # http://localhost:3000/api  |  Swagger: /api/docs
```

**Common scripts**

| Command | Purpose |
|---------|---------|
| `pnpm start:dev` | Watch-mode dev server |
| `pnpm build` / `pnpm start:prod` | Build / run `dist/main` |
| `pnpm lint` | ESLint (autofix) |
| `pnpm test` / `pnpm test:cov` | Jest unit tests / with coverage |
| `pnpm test:integration` / `pnpm test:e2e` | Integration / e2e suites (`test/jest-integration.json`, `test/jest-e2e.json`) |
| `pnpm prisma:generate` | Regenerate both Prisma clients |
| `pnpm prisma:push` | Push both schemas + run `init-vector.ts` |
| `pnpm prisma:seed` | Seed app-db |
| `pnpm db:setup` | `prisma:push` + `prisma:generate` + `prisma:seed` |

## Configuration

Copy `.env.example` → `.env`. Key variables (full annotated list in `.env.example`):

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `3000` | Server port |
| `FRONTEND_URL` | `http://localhost:1420` | OAuth redirect target (Tauri dev port) |
| `DATABASE_URL` / `APP_DATABASE_URL` | — | Raw DB / App DB Postgres URLs (required) |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | `bolt://localhost:7687` / `neo4j` / `pn_console_password` | Graph DB (non-fatal if down) |
| `JWT_SECRET` / `JWT_EXPIRATION` | — / `7d` | JWT signing + lifetime |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` | — | `openai\|anthropic\|ollama\|google-genai\|xai`; base URL required for Ollama |
| `LLM_GRAPH_PROVIDER` / `LLM_GRAPH_MODEL` | — | Dedicated model for KG extraction |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` | `openai` / `text-embedding-3-small` / `1536` | Embeddings for RAG; 768 for Ollama `nomic-embed-text` |
| `GOOGLE_CLIENT_ID/SECRET` | — | Google OAuth |
| `MICROSOFT_CLIENT_ID/SECRET` | — | Microsoft OAuth |
| `SSO_*` | — | Generic OIDC (Keycloak) issuer/URLs/client |
| `SMTP_HOST/PORT/USER/PASS/FROM` | `localhost` / `1025` / … | Outbound mail (MailHog in dev) |
| `OWNER_RESOLVER_MAX_DISTANCE` | `3` | Levenshtein threshold for fuzzy owner matching |

Plugin-specific settings (e.g. `ingestion.backfillMode`, `ingestion.dbBatchSize`, `telegram.connectionRetries`) live in namespaced config under `src/config/`.

## API Surface (summary)

Swagger at `/api/docs` documents everything; `docs/api.md` is the full reference. Endpoint groups (all under `/api`, JWT required unless marked *Public*):

| Module | Endpoints |
|--------|-----------|
| **Auth** | `POST /auth/signup*`, `POST /auth/login*`, `POST /auth/logout`, `POST /auth/forgot-password*`, `POST /auth/reset-password*`, `GET /auth/relay-reset-token*`, `GET /auth/pending-reset*`, `GET /auth/google(/callback)*`, `GET /auth/microsoft(/callback)*`, `GET /auth/sso(/callback)*` |
| **Roles** | `GET /roles`, `POST /roles`, `GET /roles/:id`, `PATCH /roles/:id`, `DELETE /roles/:id` |
| **Teams** | `GET /teams`, `POST /teams`, `GET /teams/:id`, `PATCH /teams/:id`, `DELETE /teams/:id`, `GET /teams/:teamId/members`, `POST /teams/:teamId/members`, `DELETE /teams/:teamId/members/:userId` |
| **Plugins** | `GET /plugins`, `GET/POST/PATCH/DELETE /plugins/:name(…/config)`, `POST /plugins/:name/login`, `POST /plugins/:name/logout`, `POST /plugins/:name/activate`, `POST /plugins/:name/deactivate`, `GET /plugins/:name/status`, `GET /plugins/:name/config-schema`, `GET /plugins/:name/activation-requirements` |
| **Chat** | `GET/POST /chat/conversations`, `DELETE /chat/conversations/:id`, `GET /chat/messages`, `POST /chat/messages` (SSE stream: `metadata`/`token`/`done`/`error` + keepalive), `DELETE /chat/messages/retract-last` |
| **Insights** | `GET /insights`, `GET /insights/:id` (+ `/versions`), `GET /insights/:id/versions/:versionId`, `PATCH /insights/:id` (action status), `PATCH /insights/:id/priority` |
| **Suggestions** | `GET /suggestions`, `GET /suggestions/insight/:insightId`, `POST /suggestions/generate/:insightId`, `PATCH /suggestions/:id/status` |
| **Jobs** | `GET /jobs`, `GET /jobs/:id` |
| **Profile** | `GET /profile/meta-data` |
| **Demo** | Envelope count, insight generate/persist/fetch |

## Project Structure

```
pn-console-api/
├── prisma/
│   ├── app-db/            # App DB schema, migrations, seed, init-vector.ts
│   └── raw-db/            # Raw DB schema (ingestion)
├── src/
│   ├── auth/              # Auth (strategies, guards, DTOs, signup listener)
│   ├── chat/              # Multi-conversation chat + SSE streaming + RAG context
│   ├── common/            # @Public(), global filter, providers (IEventBus/ILockManager/ICacheStore)
│   ├── config/            # Namespaced env config registrations
│   ├── demo/              # Demo/testing controllers
│   ├── graph/             # Neo4jService (global GraphModule)
│   ├── ingestion/         # Plugin system + workers (backfill/stream)
│   │   ├── plugins/providers/telegram/   # Telegram implementation
│   │   └── workers/       # IngestionWorker, WorkerManager, BatchBuffer, recovery
│   ├── insights/          # Insights CRUD API
│   ├── intelligence/      # Context building, chunking, capabilities, LLM, embeddings, suggestions, tools, triggers
│   ├── jobs/              # Job tracking + listeners
│   ├── mail/              # SMTP mailer
│   ├── prisma/            # Prisma service providers (app-db, raw-db)
│   ├── profile/           # Profile metadata API
│   ├── repositories/      # Data-access layer (15 repositories)
│   ├── roles/             # RBAC Roles controller & service
│   ├── teams/             # Teams & Team Members management controller & service
│   └── types/             # Shared TS types
├── db/init/               # SQL init scripts
├── test/                  # E2E + integration jest configs
├── docker-compose.yml     # postgres, neo4j, keycloak, mailhog, redis
└── azure-pipelines.yml    # PR validation pipeline
```

## Testing

- **Unit/integration:** Jest — `pnpm test`, `pnpm test:integration` (Jest for `*.spec.ts`)
- **E2E:** `pnpm test:e2e` (`test/jest-e2e.json`)
- Coverage: `pnpm test:cov`
- Note: the companion frontend (`pn-console-app`) uses Vitest — different runner, different config.

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/api.md`](docs/api.md) | Full API reference — endpoints, services, DTOs, types |
| [`docs/architecture.md`](docs/architecture.md) | Architecture, module graph, data flows, design decisions |
| [`docs/features.md`](docs/features.md) | Feature-by-feature walkthrough |
| [`docs/database-schema.md`](docs/database-schema.md) | Comprehensive PostgreSQL & Neo4j database schema reference |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Changelog |

## Related

- **`pn-console-app`** — the Tauri + Vue 3 desktop frontend. Talks to this API exclusively over HTTP at `http://localhost:3000/api` (never `invoke()`/direct DB). Its own docs live in `pn-console-app/docs/`.

---

