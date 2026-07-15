# pn-console-api — Agent Notes

NestJS 11 backend, Prisma 6 + PostgreSQL 16, port :3000.

## Quick reference

```bash
pnpm start:dev              # Dev with watch
pnpm lint                   # ESLint
pnpm build                  # NestJS build
pnpm prisma:generate        # Generate both Prisma clients
pnpm prisma:push            # Push both schemas
```

## Architecture

Key design: **App → HTTP → API**. Frontend (Tauri app) never calls `invoke()` — all data flows through `http://localhost:3000/api`.

### Two databases

| DB | Env var | Contents |
|---|---|---|
| `np_console_raw_db` | `DATABASE_URL` | Raw envelopes, message payloads |
| `np_console_app_db` | `APP_DATABASE_URL` | Insights, users, platform mappings |

Each has its own Prisma schema, client, and generated client under `generated/`.

### Cross-cutting gotchas

- **`organizationId` hardcoded to `'org-1'`** in `IngestionController` until auth flows provide real org context
- **Jest** (not Vitest) — config in `package.json`, test file pattern: `*.spec.ts`
- **No lint on build** — `pnpm build` only runs `nest build` without `vue-tsc` style checking
- **Swagger** at `/api/docs` — auto-generated from decorators

## Module map

```
AppModule
├── ConfigModule (global)
├── EventEmitterModule (global)
├── PrismaModule (global — provides RawDbService + AppDbService)
├── EnvelopeModule        — CRUD for raw envelopes
├── PluginsModule         — PluginManager + plugin registry
├── TelegramPluginModule  — Telegram (GramJS) plugin impl
├── IngestionModule       — Backfill orchestration
├── IntelligenceModule    — Engine, context, chunking, capabilities
├── AuthModule            — Signup, OAuth (Google/Microsoft/SSO)
└── DemoModule            — Manual testing endpoints
```

## Testing

- **NEVER run `pnpm test` or `pnpm jest`** (runs all tests — slow, hits real LLM in integration tests).
- **Only run tests for changed files:** `pnpm jest <file-path>`
  - Unit: `pnpm jest path/to/file.spec.ts`
  - Integration: `pnpm jest path/to/file.integration.spec.ts`
  - E2E: `pnpm jest test/app.e2e-spec.ts --config test/jest-e2e.json`
- Mock LLM responses in capability tests — no real API calls

## When changing across packages (api + app)

1. Change API first (app depends on API contract)
2. Verify: `pnpm lint` → API contracts stable
3. Then update app

## Docs

- `docs/ARCHITECTURE.md` — full architecture reference
- `.plan/` — development plan phases
- `user_stories/` — feature specs
