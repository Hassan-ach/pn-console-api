# PN Console API

NestJS 11 backend for PN Console — a unified data ingestion and intelligence platform. Aggregates messages from external sources (Telegram, more to come) into a standardized `Envelope` format, then extracts structured insights via an LLM-powered intelligence pipeline.

- **Framework:** NestJS 11 + TypeScript 5.x
- **Database:** PostgreSQL 16 via Prisma 6 (dual schema: raw data + app data)
- **Auth:** Passport.js (Google OAuth, Microsoft OAuth, JWT bearer, generic SSO/OIDC)
- **LLM:** LangChain (provider-agnostic: OpenAI, Anthropic, Ollama, etc.)
- **Port:** 3000 (configurable via `PORT` env)

## Quick start

```bash
# 1. Start PostgreSQL + Keycloak
docker compose up -d

# 2. Install deps
pnpm install

# 3. Generate Prisma clients
pnpm prisma:generate

# 4. Push schemas
pnpm prisma:push

# 5. Copy and edit env
cp .env.example .env
# Fill in LLM_PROVIDER, LLM_MODEL, LLM_API_KEY, JWT_SECRET, etc.

# 6. Start dev server
pnpm start:dev
```

## Project structure

```
prisma/
├── raw-db/        schema + client → np_console_raw_db
└── app-db/        schema + client → np_console_app_db

src/
├── main.ts                      Entry: Swagger, CORS, global prefix /api
├── app.module.ts                Root module
├── app.controller.ts            GET /api/health
├── auth/                        Auth (signup, Google/MS/SSO OAuth)
├── ingestion/                   Plugin system + backfill pipeline
│   └── plugins/telegram/        Telegram (GramJS) implementation
├── intelligence/                Insight extraction engine
│   ├── context/                 Window discovery + lazy retrieval
│   ├── chunking/                5-level partitioner pipeline
│   ├── capabilities/            LLM-powered insight extraction
│   ├── llm/                     LangChain wrapper
│   ├── store/                   Insight persistence
│   └── triggers/                Event-driven auto-trigger
├── envelope/                    Envelope CRUD service
├── repositories/                App-DB data access
├── types/                       Shared types (Envelope, Insight)
├── prisma/                      Prisma service wrappers
└── demo/                        Manual testing endpoints

docs/                            Architecture docs
```

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/health             | DB connectivity check |
| GET    | /api/docs               | Swagger UI |
| POST   | /api/auth/signup        | Register with email/password |
| GET    | /api/auth/google        | Google OAuth login |
| GET    | /api/auth/microsoft     | Microsoft OAuth login |
| GET    | /api/auth/sso           | Generic SSO/OIDC login |
| GET    | /api/plugins            | List registered plugins |
| POST   | /api/plugins/:name/initialize | Init plugin with config |
| POST   | /api/plugins/:name/login     | Auth plugin with credentials |
| POST   | /api/plugins/:name/action    | Plugin-specific actions (2FA, etc.) |
| DELETE | /api/plugins/:name           | Unregister plugin |
| POST   | /api/ingestion/backfill      | Trigger historical data backfill |
| GET    | /api/demo/envelopes/count   | Envelope count |
| POST   | /api/demo/insights/generate | Manual LLM insight extraction |
| POST   | /api/demo/insights/persist  | Manually persist an insight |
| GET    | /api/demo/insights          | List all insights |

## Environment variables

See `.env.example`. Key vars:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL raw-db connection |
| `APP_DATABASE_URL` | yes | PostgreSQL app-db connection |
| `LLM_PROVIDER` | yes | `openai`, `anthropic`, `ollama`, etc. |
| `LLM_MODEL` | yes | Model name (e.g. `gpt-4.1-mini`, `qwen3:8b`) |
| `LLM_API_KEY` | see note | Required unless `ollama` |
| `JWT_SECRET` | yes | JWT signing secret |
| `JWT_EXPIRATION` | no | Token expiry (default `7d`) |

## Key design principles

- **Plugin-first extensibility** — new data sources implement `IPlugin` interface, no core changes
- **Idempotent ingestion** — `@@unique([sourcePlugin, sourceId])` ensures safe retries
- **Provider-agnostic LLM** — all LLM calls through LangChain, swappable at runtime
- **Capability isolation** — each intelligence capability is independently testable
- **Deterministic chunking** — 5-level partitioner pipeline (source → group → channel → topic → daily)
- **Windowed context** — PostgreSQL-driven window discovery, lazy previous intelligence retrieval per chunk

## Scripts

```bash
pnpm build         # NestJS build
pnpm start:dev     # Dev with watch
pnpm test          # Jest unit tests
pnpm test:e2e      # E2E tests
pnpm lint          # ESLint
pnpm prisma:generate  # Generate both Prisma clients
pnpm prisma:push      # Push both schemas to DB
```
