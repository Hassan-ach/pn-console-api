# Configuration Variables Reference

Every environment variable, default value, hardcoded constant, and configurable parameter in the project.

---

## Environment Variables (`.env` / `process.env`)

| Variable | Status | Default | Meaning | Used In |
|---|---|---|---|---|
| `PORT` | Optional | `3000` | HTTP server listen port | `src/main.ts:31` |
| `DATABASE_URL` | **Required** | — | PostgreSQL connection string for raw DB (`np_console_raw_db`) | `prisma/raw-db/schema.prisma` |
| `APP_DATABASE_URL` | **Required** | — | PostgreSQL connection string for app DB (`np_console_app_db`) | `prisma/app-db/schema.prisma` |
| `LLM_PROVIDER` | **Required** | — | LLM provider name (`openai`, `ollama`, `openrouter`, etc.) | `src/intelligence/llm/llm.service.ts:27` |
| `LLM_MODEL` | **Required** | — | LLM model identifier (e.g. `gpt-4o`, `openrouter/free`) | `src/intelligence/llm/llm.service.ts:28` |
| `LLM_API_KEY` | **Required** | — | API key for the LLM provider | `src/intelligence/llm/llm.service.ts:35,45` |
| `LLM_BASE_URL` | Required when `LLM_PROVIDER=ollama` | — | Custom base URL for Ollama or other self-hosted providers | `src/intelligence/llm/llm.service.ts:32` |
| `JWT_SECRET` | **Required** | — | Secret key for signing JWT tokens | `src/auth/strategies/jwt.strategy.ts:11`, `src/auth/auth.module.ts:20` |
| `JWT_EXPIRATION` | Optional | `7d` | JWT token expiry duration | `src/auth/auth.module.ts:22` |
| `FRONTEND_URL` | **Required** | — | Frontend app URL for OAuth redirects | `src/auth/auth.controller.ts:41,63,85` |
| `GOOGLE_CLIENT_ID` | **Required** | — | Google OAuth client ID | `src/auth/strategies/google.strategy.ts:10` |
| `GOOGLE_CLIENT_SECRET` | **Required** | — | Google OAuth client secret | `src/auth/strategies/google.strategy.ts:11` |
| `GOOGLE_CALLBACK_URL` | **Required** | — | Google OAuth callback URL (e.g. `http://localhost:3000/api/auth/google/callback`) | `src/auth/strategies/google.strategy.ts:13` |
| `MICROSOFT_CLIENT_ID` | **Required** | — | Microsoft OAuth client ID | `src/auth/strategies/microsoft.strategy.ts:18` |
| `MICROSOFT_CLIENT_SECRET` | **Required** | — | Microsoft OAuth client secret | `src/auth/strategies/microsoft.strategy.ts:19` |
| `MICROSOFT_CALLBACK_URL` | **Required** | — | Microsoft OAuth callback URL | `src/auth/strategies/microsoft.strategy.ts:21` |
| `SSO_ISSUER` | **Required** | — | OIDC issuer URL for generic SSO | `src/auth/strategies/sso.strategy.ts:10` |
| `SSO_AUTHORIZATION_URL` | **Required** | — | OIDC authorization endpoint URL | `src/auth/strategies/sso.strategy.ts:11` |
| `SSO_TOKEN_URL` | **Required** | — | OIDC token endpoint URL | `src/auth/strategies/sso.strategy.ts:14` |
| `SSO_USERINFO_URL` | **Required** | — | OIDC userinfo endpoint URL | `src/auth/strategies/sso.strategy.ts:15` |
| `SSO_CLIENT_ID` | **Required** | — | SSO OIDC client ID | `src/auth/strategies/sso.strategy.ts:16` |
| `SSO_CLIENT_SECRET` | **Required** | — | SSO OIDC client secret | `src/auth/strategies/sso.strategy.ts:17` |
| `SSO_CALLBACK_URL` | **Required** | — | SSO OIDC callback URL | `src/auth/strategies/sso.strategy.ts:19` |

---

## Hardcoded Values in Code

### 1. Session Secret
- **Value:** `'pn-console-dev-session-secret'`
- **File:** `src/main.ts:13`
- **Meaning:** Secret for `express-session` middleware (hardcoded dev secret — insecure for production)

### 2. OpenRouter Base URL
- **Value:** `'https://openrouter.ai/api/v1'`
- **File:** `src/intelligence/llm/llm.service.ts:40`
- **Meaning:** Hardcoded base URL when `LLM_PROVIDER=openrouter` (overrides any `LLM_BASE_URL`)

### 3. Organization ID (`org-1`)
- **Value:** `'org-1'`
- **Files:**
  - `src/ingestion/ingestion.controller.ts:25` — backfill endpoint
  - `src/demo/demo-intelligence.controller.ts:16,25` — intelligence demo endpoint
- **Meaning:** Hardcoded placeholder org ID until auth lands. Used in ingestion and demo controllers.

### 4. Demo Source Plugin
- **Value:** `'demo'`
- **File:** `src/demo/demo-generation.controller.ts:27`
- **Meaning:** Hardcoded `sourcePlugin` value for demo-generated envelopes

### 5. Capability Name
- **Value:** `'insights-extractor'`
- **File:** `src/demo/demo-generation.controller.ts:86`
- **Meaning:** Hardcoded capability name used in the demo generate endpoint

### 6. Microsoft Tenant
- **Value:** `'common'`
- **File:** `src/auth/strategies/microsoft.strategy.ts:26`
- **Meaning:** Microsoft OAuth tenant (hardcoded to `common` for multi-tenant)

### 7. SSO Scope
- **Value:** `'openid profile email'`
- **File:** `src/auth/strategies/sso.strategy.ts:21`
- **Meaning:** Hardcoded OIDC scope string for generic SSO

### 8. Google OAuth Scope
- **Value:** `['email', 'profile']`
- **File:** `src/auth/strategies/google.strategy.ts:17`
- **Meaning:** Hardcoded OAuth scopes for Google login

### 9. Microsoft OAuth Scope
- **Value:** `['user.read']`
- **File:** `src/auth/strategies/microsoft.strategy.ts:23`
- **Meaning:** Hardcoded OAuth scope for Microsoft login

### 10. Telegram Client Connection Retries
- **Value:** `5`
- **File:** `src/ingestion/plugins/telegram/telegram-client.factory.ts:18`
- **Meaning:** Number of connection retry attempts for GramJS Telegram client

---

## Hardcoded Defaults / Tuning Parameters

| Value | Default | Meaning | File |
|---|---|---|---|
| `maxIterations` | `3` | Max LLM tool-calling chain iterations | `src/intelligence/llm/llm.service.ts:87` |
| `maxIterations` | `3` | Max iterations for insight-extraction tool chain | `src/intelligence/capabilities/insights-extraction/insight-extraction.capability.ts:32` |
| `MAX_RETRIES` | `3` | Max retries for JSON parse of LLM insight output | `src/intelligence/capabilities/insights-extraction/insight-extraction.capability.ts:63` |
| `DEFAULT_INSIGHT_LIMIT` | `20` | Max previous insights fetched per scope query | `src/intelligence/context/builders/in-memory-enterprise-context-builder.ts:18` |
| `limit` | `5` | Default previous-insight limit for per-chunk query | `src/intelligence/intelligence-engine.service.ts:89,104` |
| `minChunkMessages` | `30` | Min messages for daily partitioner to split | `src/intelligence/chunking/chunking.module.ts:24` |
| `maxChunkMessages` | `60` | Max messages per daily partitioner merged chunk | `src/intelligence/chunking/chunking.module.ts:25` |
| `gapMinutes` | `30` | Time gap (minutes) to trigger TimeGapChunk split | `src/intelligence/chunking/strategies/time-gap-chunk.strategy.ts:18` |
| `maxWindowMinutes` | `240` | Max window (minutes) before forcing TimeGap split | `src/intelligence/chunking/strategies/time-gap-chunk.strategy.ts:19` |
| `JWT_EXPIRATION` | `'7d'` | JWT token lifetime when env var not set | `src/auth/auth.module.ts:22` |

---

## API & Infrastructure Constants

| Value | Meaning | File |
|---|---|---|
| `'pn-console-api'` | NestJS project name | `package.json:name` |
| `'0.0.1'` | Swagger doc version | `src/main.ts:27` |
| `'PN Console API'` | Swagger doc title | `src/main.ts:26` |
| `'api'` | Global API prefix | `src/main.ts:22` |
| `'api/docs'` | Swagger UI path | `src/main.ts:31` |
| `postgres:16-alpine` | PostgreSQL Docker image | `docker-compose.yml:3` |
| `pn_console_postgres` | Docker container name | `docker-compose.yml:4` |
| `5432` | Postgres host port | `docker-compose.yml:14` |
| `pn_console` | Default Postgres user/password | `docker-compose.yml:7,8`, `.env.example` |
| `np_console_raw_db` | Raw DB name | `.env.example:DATABASE_URL` |
| `np_console_app_db` | App DB name | `.env.example:APP_DATABASE_URL` |
| `admin` / `admin` | Keycloak bootstrap credentials | `docker-compose.yml:25,26` |
| `8080` | Keycloak host port | `docker-compose.yml:30` |

---

## Where Each Env Var Is Declared vs Used

| Variable | Declared In | Used In |
|---|---|---|
| `DATABASE_URL` | `.env.example`, `.env` | `prisma/raw-db/schema.prisma` |
| `APP_DATABASE_URL` | `.env.example`, `.env` | `prisma/app-db/schema.prisma` |
| `PORT` | `.env.example`, `.env` | `src/main.ts:31` |
| `JWT_SECRET` | `.env.example`, `.env` | `src/auth/strategies/jwt.strategy.ts:11`, `src/auth/auth.module.ts:20` |
| `JWT_EXPIRATION` | `.env.example`, `.env` | `src/auth/auth.module.ts:22` |
| `FRONTEND_URL` | — | `src/auth/auth.controller.ts:41,63,85` |
| `GOOGLE_CLIENT_ID` | `.env.example`, `.env` | `src/auth/strategies/google.strategy.ts:10` |
| `GOOGLE_CLIENT_SECRET` | `.env.example`, `.env` | `src/auth/strategies/google.strategy.ts:11` |
| `GOOGLE_CALLBACK_URL` | `.env.example`, `.env` | `src/auth/strategies/google.strategy.ts:13` |
| `MICROSOFT_CLIENT_ID` | `.env` | `src/auth/strategies/microsoft.strategy.ts:18` |
| `MICROSOFT_CLIENT_SECRET` | `.env` | `src/auth/strategies/microsoft.strategy.ts:19` |
| `MICROSOFT_CALLBACK_URL` | `.env` | `src/auth/strategies/microsoft.strategy.ts:21` |
| `SSO_ISSUER` | `.env` | `src/auth/strategies/sso.strategy.ts:10` |
| `SSO_AUTHORIZATION_URL` | `.env` | `src/auth/strategies/sso.strategy.ts:11` |
| `SSO_TOKEN_URL` | `.env` | `src/auth/strategies/sso.strategy.ts:14` |
| `SSO_USERINFO_URL` | `.env` | `src/auth/strategies/sso.strategy.ts:15` |
| `SSO_CLIENT_ID` | `.env` | `src/auth/strategies/sso.strategy.ts:16` |
| `SSO_CLIENT_SECRET` | `.env` | `src/auth/strategies/sso.strategy.ts:17` |
| `SSO_CALLBACK_URL` | `.env` | `src/auth/strategies/sso.strategy.ts:19` |
| `LLM_PROVIDER` | `.env.example`, `.env` | `src/intelligence/llm/llm.service.ts:27` |
| `LLM_MODEL` | `.env.example`, `.env` | `src/intelligence/llm/llm.service.ts:28` |
| `LLM_API_KEY` | `.env.example`, `.env` | `src/intelligence/llm/llm.service.ts:35,45` |
| `LLM_BASE_URL` | `.env.example`, `.env` | `src/intelligence/llm/llm.service.ts:32` |
| `SSO_SCOPE` | `.env` | `src/auth/strategies/sso.strategy.ts:21` (hardcoded, not read from env) |

> **Note:** `FRONTEND_URL` and `SSO_SCOPE` are used in code but `FRONTEND_URL` is **not** listed in `.env.example`. `SSO_SCOPE` is in `.env` but hardcoded in the SSO strategy file — the env value is never actually read.
