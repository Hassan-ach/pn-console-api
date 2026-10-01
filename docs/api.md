# API Reference

## Modules & Exports

### `src/app.module.ts`
- **AppModule** — Root module. Imports all feature modules; registers `ConfigModule` (global, 13 config namespaces — added `embeddingsConfig`), `EventEmitterModule`, global `JwtAuthGuard`.

### `src/main.ts`
- **Bootstrap** — Creates NestJS app with:
  - Global prefix: `/api`
  - ValidationPipe (transform, whitelist)
  - GlobalExceptionFilter
  - Swagger docs at `/api/docs`
  - CORS enabled
  - Express session middleware

---

### Auth (`src/auth/`)

**`AuthController`** — `@Controller('auth')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | Public | Register with email/password. Returns JWT + user. |
| POST | `/auth/login` | Public | Login with email/password. Returns JWT + user. |
| POST | `/auth/logout` | JWT | Logout; increments tokenVersion to invalidate tokens. |
| POST | `/auth/forgot-password` | Public | Send password reset email. |
| POST | `/auth/reset-password` | Public | Reset password using token from email. |
| GET | `/auth/relay-reset-token` | Public | Relay reset token from browser to backend (renders HTML). |
| GET | `/auth/pending-reset` | Public | Check for pending relayed reset token by email. |
| GET | `/auth/google` | Public | Initiate Google OAuth login. |
| GET | `/auth/google/callback` | Public | Google OAuth callback → redirect to frontend with JWT. |
| GET | `/auth/microsoft` | Public | Initiate Microsoft OAuth login. |
| GET | `/auth/microsoft/callback` | Public | Microsoft OAuth callback → redirect to frontend with JWT. |
| GET | `/auth/sso` | Public | Initiate SSO (OIDC) login. |
| GET | `/auth/sso/callback` | Public | SSO OIDC callback → redirect to frontend with JWT. |

**`AuthService`**
- `signup(dto: SignupDto)` — Create user with EMAIL provider, return JWT; emits `user.signed.up` event (JWT payload includes `organizationId`)
- `login(dto: LoginDto)` — Authenticate with email/password, return JWT
- `logout(userId: string)` — Increment tokenVersion
- `forgotPassword(dto: ForgotPasswordDto)` — Generate reset token, send email
- `resetPassword(dto: ResetPasswordDto)` — Validate token, update password, return JWT
- `relayResetToken(token: string)` — Mark token as `relayedAt` timestamp (browser relay for desktop)
- `getPendingReset(email: string)` — Return pending relayed token (polls from desktop)
- `loginOrCreateGoogleUser(profile)` — OAuth login/create for Google; emits `user.signed.up` event for new users
- `loginOrCreateMicrosoftUser(profile)` — OAuth login/create for Microsoft; emits `user.signed.up` event for new users
- `loginOrCreateSsoUser(profile)` — OAuth login/create for SSO; emits `user.signed.up` event for new users

**`JwtStrategy`** (`src/auth/strategies/jwt.strategy.ts`) — UPDATED:
- Validated payload now returns `organizationId` (resolved from user record, defaults to `'org-1'`)

**Events & Listeners**
- `UserSignedUpEvent` — `{ userId, firstName, lastName, email }` — Emitted on `user.signed.up` channel
- `SignupListener` — `@OnEvent('user.signed.up')` handler that:
  - `assignBroadcastedInsights(userId)` — Assigns latest broadcasted insight versions to new user
  - `resolveUnresolvedOwners(event)` — Fuzzy-matches new user's name against unresolved owners (Levenshtein distance, configurable `OWNER_RESOLVER_MAX_DISTANCE`), creates assignments and deletes resolved records

**DTOs**
- `SignupDto` — `firstName`, `lastName`, `email`, `password`
- `LoginDto` — `email`, `password`
- `ForgotPasswordDto` — `email`
- `ResetPasswordDto` — `token`, `password`

**Auth types**
- `Express.User` — Extended in `src/types/express.d.ts`: `{ id, email, firstName, lastName, providerType }`

**Strategies**
- `JwtStrategy` — Extracts JWT from `Authorization: Bearer` header
- `JwtLogoutStrategy` — Same as JWT but doesn't fail on missing token
- `GoogleStrategy` — Passport Google OAuth 2.0
- `MicrosoftStrategy` — Passport Microsoft OAuth 2.0
- `SsoStrategy` — Passport OpenID Connect (OIDC)

**Guards**
- `JwtAuthGuard` — Global guard (except `@Public()` routes)

---

### Roles (`src/roles/`)

**`RolesController`** — `@Controller('roles')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/roles` | JWT | List all available roles in the system |
| GET | `/roles/:id` | JWT | Get role details by ID |
| POST | `/roles` | JWT + Admin | Create a new role |
| PATCH | `/roles/:id` | JWT + Admin | Update role details |
| DELETE | `/roles/:id` | JWT + Admin | Delete a role |

**DTOs**
- `CreateRoleDto` — `{ name: string, description?: string }`
- `UpdateRoleDto` — `{ name?: string, description?: string }`

---

### Teams (`src/teams/`)

**`TeamsController`** — `@Controller('teams')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/teams` | JWT | List all teams |
| GET | `/teams/:id` | JWT | Get team details including members and assigned roles |
| POST | `/teams` | JWT + Admin | Create a new team |
| PATCH | `/teams/:id` | JWT + Admin | Update team name/description |
| DELETE | `/teams/:id` | JWT + Admin | Delete a team |

**`TeamMembersController`** — `@Controller('teams/:teamId/members')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/teams/:teamId/members` | JWT + Admin | Add a user to team with assigned role IDs |
| POST | `/teams/:teamId/members/me` | JWT | Join the team as current user |
| PATCH | `/teams/:teamId/members/me` | JWT | Update own assigned roles within the team |
| DELETE | `/teams/:teamId/members/me` | JWT | Leave the team (remove own membership) |
| PATCH | `/teams/:teamId/members/:userId` | JWT + Admin | Update member roles within the team |
| DELETE | `/teams/:teamId/members/:userId` | JWT + Admin | Remove a user from the team |

**DTOs**
- `CreateTeamDto` — `{ name: string, description?: string }`
- `UpdateTeamDto` — `{ name?: string, description?: string }`
- `AddMemberDto` — `{ userId: string, roleIds?: string[] }`
- `UpdateMemberDto` — `{ roleIds: string[] }`
- `JoinTeamDto` — `{ roleIds?: string[] }`

---

### Ingestion (`src/ingestion/`)

**`IngestionModule`** — Empty module (controller-less). Old ingestion controller/services removed; functionality moved into plugin activation/worker flow.

---

### Plugins (`src/ingestion/plugins/`)

**`PluginsController`** — `@Controller('plugins')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/plugins` | JWT | List registered plugins with connection status |
| GET | `/plugins/:name` | JWT | Get plugin state (initialized, hasSession, isConnected) |
| POST | `/plugins/:name/config` | JWT | Create/replace plugin config |
| GET | `/plugins/:name/config` | JWT | Get plugin config (sessionString masked) |
| PATCH | `/plugins/:name/config` | JWT | Partially update plugin config (deep merge) |
| POST | `/plugins/:name/login` | JWT | Authenticate with plugin platform, store session |
| POST | `/plugins/:name/logout` | JWT | Disconnect — clear session string |
| POST | `/plugins/:name/activate` | JWT | Activate plugin — start backfill + stream workers |
| POST | `/plugins/:name/deactivate` | JWT | Deactivate plugin — stop all workers |
| GET | `/plugins/:name/config-schema` | JWT | Get config schema for rendering dynamic forms |
| GET | `/plugins/:name/activation-requirements` | JWT | Get activation requirements and whether they are met |
| GET | `/plugins/:name/status` | JWT | Get plugin activation status with per-chat worker state |
| DELETE | `/plugins/:name` | JWT | Unregister plugin instance |

**DTOs**
- `PluginConfigDto` — `{ config: Record<string, unknown> }`
- `PluginLoginDto` — `{ config: Record<string, unknown> }`
- `PluginUpdateChatsDto` — `{ chats: ChatItemDto[] }`
  - `ChatItemDto` — `{ id: string, name: string, historyLimit?: number }`

**`PluginManagerService`** (`src/ingestion/plugins/services/plugin-manager.service.ts`)
- `register(plugin: IPlugin)` — Register a plugin instance
- `unregister(name: string)` — Remove plugin
- `get(name: string)` — Get plugin by name
- `getContext()` — Return `PluginContext`
- `backfill(name, opts)` — Async-generator, yield `StoreResult`
- `getState(name, userId)` — Get connection state
- `list(userId)` — List all plugins with status (per-plugin errors caught without crashing)
- `updateConfig(name, config, userId)` — Deep-merge config update
- `getConfigSchema(name)` — Get field schema for dynamic form rendering
- `getActivationRequirements(name, userId)` — Get validation requirements for activation

**`PluginConfigService`** (`src/ingestion/plugins/services/plugin-config.service.ts`) — Extracted from `PluginManagerService`
- `getConfig(name, userId)` — Get raw config
- `createConfig(userId, pluginName, data)` — Create/upsert config
- `getSanitizedConfig(name, userId)` — Get config without secrets
- `updateConfig(name, userId, data)` — Deep-merge update, publishes `plugin.config.updated` event
- `deleteConfig(name, userId)` — Remove config
- `disconnect(name, userId)` — Clear session string
- `login(name, userId, config, validateAuth, context)` — Validate session, store config + mapping

**`PluginContextService`** (`src/ingestion/plugins/services/plugin-context.service.ts`) implements `PluginContext`
- `getConfig(userId, pluginName)` — Read config + sessionString
- `saveConfig(userId, pluginName, config)` — Upsert config
- `updateConfig(userId, pluginName, partial)` — Partial update
- `storeUserMapping(userId, pluginName, data)` — Save platform→app user mapping
- `storeEnvelopes(items, userId)` — Batch insert envelopes with dedup (preserves per-envelope `organizationId`)
- `getCursor(pluginName, userId, key)` — Read cursor position
- `saveCursor(pluginName, userId, key, value)` — Save cursor position
- `resolveOrgId(userId)` → `'org-1'`

**`PluginActivationService`** (`src/ingestion/plugins/services/plugin-activation.service.ts`)
- `activate(userId: string, pluginName: string)` — Validates config, registers active listeners, starts `IngestionWorker` per chat via `WorkerManager`; publishes `plugin.activated` event
- `deactivate(userId: string, pluginName: string)` — Aborts all workers for plugin, publishes `plugin.deactivated` event, sets status to `CONFIGURED`
- `getStatus(userId: string, pluginName: string)` — Returns `PluginStatus` + `WorkerState[]` per active chat (includes `platformUsername`, `platformUserId`)

**`WorkerManager`** (`src/ingestion/workers/worker-manager.service.ts`) — Refactored to event-driven
- Implements `OnApplicationBootstrap` — On startup, re-acquires active listeners via `ILockManager` distributed locks
- Implements `OnApplicationShutdown` — Releases all locks
- `start(config)` — Starts workers for all chats in a plugin config
- `startWorker(pluginName, chatId, config)` — Creates and runs an `IngestionWorker`
- `stop(pluginName, chatId)` — Aborts a worker and releases lock
- `syncWorkersForConfig(config)` — Dynamic worker syncing: stops removed chats, starts new ones
- `getState(pluginName, chatId)` — Returns `WorkerState` for a specific chat
- Subscribes to `plugin.activated`, `plugin.deactivated`, `plugin.config.updated` events
- Uses `ILockManager` (injected via `LOCK_MANAGER_TOKEN`) instead of direct `RedisService`
- Uses `IEventBus` (injected via `EVENT_BUS_TOKEN`) instead of direct `EventEmitter2`
- Detects session-expired errors and triggers `WorkerRecoveryService`

**`IngestionWorker`** (`src/ingestion/workers/ingestion-worker.service.ts`) — Not a NestJS provider (plain class)
- `run()` — Starts backfill + stream concurrently via `AbortController`, waits for backfill to complete, triggers backfill intelligence via `IEventBus` or direct call, then waits for stream
- `abort()` — Aborts both backfill and stream (flushes DB buffer first)
- `getState()` — Returns `WorkerState`

**`WorkerRecoveryService`** (`src/ingestion/workers/worker-recovery.service.ts`) — New
- `recoverFromSessionExpiry(pluginName, chatId, onNewOwnerConfig)` — Detects expired sessions, sets status to `ERROR`, restarts worker with new owner config

**`WorkersModule`** (`src/ingestion/workers/workers.module.ts`) — New module, exports `WorkerManager`

**Interfaces**
- `IPlugin<TConfig extends BaseProviderConfig>` — `{ name, validateAuth, isConnected, backfill, startStream, getConfigSchema?, getActivationRequirements?, parseConfig? }`
  - `backfill()` accepts optional `AbortSignal`
  - `stopStream` removed (caller controls signal)
  - `getConfigSchema()` — Optional, returns `ConfigFieldSchema[]` for dynamic UI
  - `getActivationRequirements()` — Optional, returns `ActivationRequirement[]` validation rules per config
  - `parseConfig(raw)` — Optional, returns typed `TConfig`
  - `startStream(StreamOpts)` — `StreamOpts` includes `cursor?: number`
- `PluginContext` — `{ getConfig, saveConfig, updateConfig, storeUserMapping, storeEnvelopes, getCursor, saveCursor, resolveOrgId, logger }`
- `StoreResult` — `{ inserted: number, ids: string[] }`
- `PlatformUserInfo` — `{ platformUserId, platformUsername }`
- `BackFillOpts` — `{ limit, userId, chatId }`
- `StreamOpts` — `{ userId, chatId, cursor?: number }`
- `StreamBatch` — `{ envelopes: EnvelopeWithPayload[], lastMessageId?: number }`
- `ActivationRequirement` — `{ field: string, message: string, validate: (config) => boolean }`
- `BaseProviderConfig` — `{ chats: ProviderChatEntry[], [key: string]: unknown }`
- `ProviderChatEntry` — `{ id: string, name: string, historyLimit?: number }`
- `ConfigFieldSchema` — `{ key, label, type, required, placeholder?, description? }`
- `ActivationRequirementResult` — `{ field, message, met }`

**Base Plugin Provider** (`src/ingestion/plugins/common/base-plugin-provider.ts`) — New abstract class:
- `BasePluginProvider<TConfig>` implements `IPlugin<TConfig>`
- `parseConfig(raw)` returns typed `TConfig`
- Abstract `validateAuthImpl(sessionString, context)` and `isConnectedImpl(config?, context?)`

**Types**
- `WorkerState` — `{ backfill: 'IDLE'|'RUNNING'|'COMPLETED', stream: 'IDLE'|'LISTENING'|'STOPPED', startedAt: Date, backfillProgress?: { inserted: number, ids: string[] }, flushes?: number }`

---

### Insights (`src/insights/`)

**`InsightsController`** — `@Controller('insights')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/insights` | JWT | List insights for user (`?type=TASK|INFO|URGENCY|DECISION`, `?status=PENDING|DONE|...`) |
| GET | `/insights/:id` | JWT | Get insight detail by ID |
| PATCH | `/insights/:id` | JWT | Set action status (`?action=DONE|NOTED|BLOCKED|etc`) |
| GET | `/insights/:id/versions` | JWT | List all versions of an insight |
| GET | `/insights/:id/versions/:versionId` | JWT | Get specific version |
| GET | `/insights/:id/versions/:versionId/envelope-refs` | JWT | Get envelope refs for a version |
| PATCH | `/insights/:id/priority?priority=N` | JWT | Override priority on an insight (1-10) |

**DTOs**
- `InsightsQueryDto` — `{ type?: InsightType, status?: InsightActionStatus }`
- `InsightActionQueryDto` — `{ action: InsightActionStatus }`
- `InsightResponseDto` — Version list response (now includes `priority?: number`, `deadline?: Date`)
- `InsightDetailResponseDto` — Full insight detail response (now includes `priority?: number`, `deadline?: Date`)
- `InsightPriorityQueryDto` — `{ priority: number }` (validated 1-10)

**`InsightsService`**
- `findAllForUser(userId, type?, status?)` — Insights visible to user (owner or broadcasted), optionally filtered by type and status; returns `priority` and `deadline`
- `findOneForUser(id, userId)` — Single insight with access check, includes `status`, `priority`, `deadline`, and scoping fields
- `updateActionStatus(id, userId, action)` — Validate action per type, upsert status
- `updatePriority(id, userId, priority)` — Finds insight, gets latest version, upserts priority via `InsightActionRepository.upsertPriority()`
- `findVersionsForUser(id, userId)` — Version history (now includes `priority` and `deadline`)
- `findVersionForUser(id, versionId, userId)` — Specific version (now includes `priority` and `deadline`)
- `findVersionEnvelopeRefs(id, versionId, userId)` — Envelope refs for version

---

### Chat (`src/chat/`) — MULTI-CONVERSATION

**`ChatController`** — `@Controller('chat')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chat/conversations?page=&limit=` | JWT | List conversations for the user (ordered by updatedAt desc, paginated) |
| POST | `/chat/conversations` | JWT | Create a new empty conversation |
| DELETE | `/chat/conversations/:id` | JWT | Delete a conversation and all its messages |
| GET | `/chat/messages?conversationId=&page=&limit=` | JWT | Get chat history for a conversation (createdAt asc) |
| POST | `/chat/messages` | JWT | Send a message and receive an SSE stream of response tokens |
| DELETE | `/chat/messages/retract-last?conversationId=` | JWT | Delete the last USER+ASSISTANT message pair (for retry) |

**`ChatService`** (`src/chat/chat.service.ts`)
- `getConversations(userId, page?, limit?)` — Paginated conversation list with messageCount, lastMessage (120-char preview), lastMessageAt
- `createConversation(userId)` — New empty conversation (title `New chat`)
- `resolveConversation(userId, conversationId?)` — Resolves the target conversation: explicit ID (ownership-checked), else latest conversation if it has messages within `CONVERSATION_TIMEOUT_MS` (30 min) or is empty, else creates a new one
- `getHistory(userId, conversationId?, page?, limit?)` — Paginated messages for a conversation (falls back to latest conversation)
- `deleteConversation(userId, conversationId)` — Deletes conversation + messages (ownership-checked, 404 if missing)
- `retractLastMessages(userId, conversationId?)` — Delete last USER+ASSISTANT pair; validates pair structure
- `streamResponse(userId, conversationId, userMessage, signal?)` — AsyncGenerator that:
  - Loads last 20 messages of the conversation history
  - Builds RAG context via `ChatContextService.buildContext(userId, userMessage)`
  - Streams LLM response token-by-token via `LlmService.createStreamingLLM()`
  - Persists USER + ASSISTANT messages in a transaction after streaming completes
  - Auto-titles the conversation from the first message when message count reaches 2 (max `TITLE_MAX_LENGTH` = 80 chars)
  - Handles `AbortError` gracefully (connection close)

**SSE protocol** (`POST /chat/messages`): `Content-Type: text/event-stream`; emits `data:` frames with `{type:'metadata', conversationId}`, `{type:'token', content}`, `{type:'done'}`, `{type:'error', message}` plus a `:keepalive` comment every 15s; aborts LLM stream on client disconnect

**`ChatContextService`** (`src/chat/chat-context.service.ts`) — RAG context builder:
- Hybrid retrieval strategy:
  1. Structured filter query via `EmbeddingRepository.findByFilters()` (when type/status keywords detected)
  2. Semantic search via `EmbeddingRepository.searchSimilar()` at 0.65 threshold
  3. Fallback semantic search at 0.45 threshold
  4. Recent insights fallback (for broad queries like "Summarize my day")
- Merges results with dedup; formats insights with type, status, priority, source, dates, deadline labels (OVERDUE, DUE TODAY, in N days)

**DTOs**
- `SendMessageDto` — `{ message: string, conversationId?: string }` (conversationId optional UUID)

**ChatModule** — Imports `AppDbModule`, `RepositoriesModule`, `LlmModule`, `EmbeddingsModule`, `AuthModule`. Exports `ChatContextService`, `ChatService`.

---

### Profile (`src/profile/`)

**`ProfileController`** — `@Controller('profile')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile/meta-data` | JWT | Get user profile metadata (id, firstName, lastName, email) |

**`ProfileService`** (`src/profile/profile.service.ts`)
- `getMetaData(userId)` — Fetch user by ID, throws `NotFoundException` if missing

**DTOs**
- `ProfileMetaDataDto` — `{ id, firstName, lastName, email }` (exposed via `class-transformer`)

**ProfileModule** — Imports `RepositoriesModule`

---

### Jobs (`src/jobs/`)

**`JobsController`** — `@Controller('jobs')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/jobs` | JWT | List jobs for authenticated user, optional `?status=` filter |
| GET | `/jobs/:id` | JWT | Get job by ID |

**`JobService`** (`src/jobs/job.service.ts`)
- `createJob(title, userId?, description?, progressable?, progress?, message?, organizationId?, status?)` — Create new job
- `getJob(id)` — Get job by ID, throws `NotFoundException`
- `getJobsByUser(userId, status?)` — List user's jobs, optional status filter
- `startJob(id)` — Set status to RUNNING + startedAt
- `updateMessage(id, message)` — Update message only
- `updateProgress(id, progress, message?)` — Update progress + optional message
- `updateTitle(id, title)` — Update title
- `updateDescription(id, description)` — Update description
- `updateProgressable(id, progressable)` — Update progressable flag
- `completeJob(id, message?)` — Set COMPLETED + completedAt
- `failJob(id, message?)` — Set FAILED + completedAt

**`JobTrackingListener`** (`src/jobs/job-tracking.listener.ts`)
Listens for `job.intelligence.*` events and delegates to `JobService`:
- `job.intelligence.started` → create + start job
- `job.intelligence.setTitle` → updateTitle
- `job.intelligence.setDescription` → updateDescription
- `job.intelligence.setProgressable` → updateProgressable
- `job.intelligence.setProgress` → updateProgress
- `job.intelligence.message` → updateMessage
- `job.intelligence.completed` → completeJob
- `job.intelligence.failed` → failJob

**Events** (`src/jobs/events/intelligence-job.events.ts`)
- `IntelligenceJobStartedEvent` — `{ organizationId, userId, title, progressable, description?, message? }`
- `IntelligenceJobSetTitleEvent` — `{ jobId, title }`
- `IntelligenceJobSetDescriptionEvent` — `{ jobId, description }`
- `IntelligenceJobSetProgressableEvent` — `{ jobId, progressable }`
- `IntelligenceJobSetProgressEvent` — `{ jobId, progress }`
- `IntelligenceJobMessageEvent` — `{ jobId, message }`
- `IntelligenceJobCompletedEvent` — `{ jobId, message? }`
- `IntelligenceJobFailedEvent` — `{ jobId, message? }`

**DTOs**
- `JobResponseDto` — `{ id, title, description, progressable, progress, message, status, startedAt, completedAt, createdAt, updatedAt }`
- `JobsQueryDto` — `{ status?: JobStatus }`

**JobsModule** — Imports `RepositoriesModule`

---

### Demo (`src/demo/`)

**`DemoController`** — `@Controller('demo')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/demo/envelopes/count` | JWT | Envelope count (optional `?sourcePlugin=`) |
| GET | `/demo/insights` | JWT | Get all insights (raw) |

**`DemoGenerationController`** — `@Controller('demo/insights')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/demo/insights/generate` | JWT | Extract insights from messages via LLM |

**`DemoPersistenceController`** — `@Controller('demo/insights')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/demo/insights/persist` | JWT | Persist extracted insights to DB |
| GET | `/demo/insights` | JWT | Fetch all persisted insights |

**DTOs**
- `GenerateInsightsDto` — Messages to analyze
- `PersistInsightsDto` — Insights to persist

---

### Health

**`AppController`** — `@Controller('')`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Health check, returns `{status, database}` |

---

### Batch Buffer (`src/ingestion/workers/`)

**`BatchBuffer`** (`src/ingestion/workers/batch-buffer.service.ts`) — Not a NestJS provider (plain class) — **Moved from `src/ingestion/streaming/`**
- `constructor(batchSize, maxWindowMs, onFlush)` — Flushes when batch size reached or window expires
- `add(item)` — Queue item, triggers flush at threshold
- `flush()` — Force flush pending items

---

### Common Providers (`src/common/providers/`) — NEW

Global module providing abstract infrastructure interfaces with in-memory implementations (replaces previous `RedisService`/`RedisModule`).

**`IEventBus`** (`event-bus/event-bus.interface.ts`) — Injected via `EVENT_BUS_TOKEN` — TYPED
- `publish<K extends keyof EventMap>(event: K, payload: EventMap[K])` — Emit an event
- `publishAsync<K>` — Emit and await listener results (`EventEmitter2.emitAsync`)
- `subscribe<K>(event: K, handler, options?: SubscribeOptions)` — Register handler; returns `UnsubscribeFn`
- `SubscribeOptions` — `{ retries?, backoffMs? }` — handler retry with exponential backoff
- Implementation: `InMemoryEventBus` — Wraps NestJS `EventEmitter2`; retries failed handlers up to `retries` with `backoffMs * 2^(n-1)` backoff

**`Events` registry** (`event-bus/events.registry.ts`) — NEW central event catalog:
- `Events` const — all event names: `USER_SIGNED_UP`, `ENVELOPES_INGESTED`, `INSIGHT_VERSIONS_CREATED`, `EMBEDDINGS_GENERATE`, `PLUGIN_ACTIVATED`, `PLUGIN_DEACTIVATED`, `PLUGIN_CONFIG_UPDATED`, `JOB_INTELLIGENCE_*` (started, setTitle, setDescription, setProgressable, setProgress, message, completed, failed)
- `EventMap` — maps each event name to its payload type (compile-time typing)
- `EmbeddingsBatchEvent` — `{ items: Array<{ versionId, content }> }` — payload for both embedding events

**`ILockManager`** (`lock-manager/lock-manager.interface.ts`) — Injected via `LOCK_MANAGER_TOKEN`
- `acquire(key, ownerId, ttlMs?)` — Acquire distributed lock, returns boolean
- `release(key, ownerId)` — Release lock, returns boolean
- `isLocked(key)` — Check if lock is held (expired locks auto-release)
- Implementation: `InMemoryLockManager` — Uses `Map<string, LockEntry>` with expiry checking

**`ICacheStore`** (`cache-store/cache-store.interface.ts`) — Injected via `CACHE_STORE_TOKEN`
- `get<T>(key)` — Get value or null
- `set<T>(key, value, ttlMs?)` — Set with optional TTL
- `delete(key)` — Remove entry
- Implementation: `InMemoryCacheStore` — Uses `Map<string, CacheEntry>` with expiry checking

**`CommonProvidersModule`** — `@Global()` module, wires all three interfaces via DI tokens

---

### Intelligence (`src/intelligence/`)

**`IntelligenceEngineService`**
- `run(organizationId, opts?)` — Full intelligence pipeline: discover windows → chunk → capability execution → persist. Emits `job.intelligence.*` events via `IEventBus`.
  - `opts.userId` — Enables job tracking
  - `opts.envelopeIds` — Scoped envelope bag (used by backfill intelligence trigger)
  - `opts.windowStart/End` — Window bounds
  - `opts.progressable` — Whether job supports progress tracking
  - Note: `skipChunking` option removed — all runs go through chunking pipeline
- No longer subscribes to events directly — ingestion triggers call `run()` via `EnvelopesIngestedListener`
- Pipeline execution order:
  1. **Knowledge Graph Extraction** (`knowledge-graph-extractor`) — Non-fatal; errors logged + recorded as capability failures
  2. **Insight Extraction V2** (`insights-extractor-v2`) — Primary extraction; envelope status set to `READY` on success, `FAILED` on error
- V1 `insights-extractor` capability remains registered but no longer called in `executeRun()`

**`LlmService`** (`src/intelligence/llm/llm.service.ts`) — UPDATED:
- `createLLM()` — Create chat model from env config (`LLM_PROVIDER`, `LLM_MODEL`, etc.)
- `createGraphLLM()` — NEW: Create LLM for graph operations with separate config (`llm.graphProvider`, `llm.graphModel`, `llm.graphApiKey`, `llm.graphBaseUrl`); falls back to main LLM config when graph-specific config absent
- `createStreamingLLM()` — NEW: Create chat model with `streaming: true` for SSE token-by-token chat responses
- `createToolModel(tools)` — Bind tools to LLM; throws if model doesn't support tool calling
- `createToolChain(config: ToolCallingChainConfig)` — NEW: Multi-iteration tool-calling chain:
  - Binds tools via `.bindTools()`
  - Iterates up to `config.maxIterations` (default 3): invokes model, checks `tool_calls`, executes tools via `ToolMessage`
  - Returns content when no more tool calls; throws on iteration limit

**`LlmTypes`** (`src/intelligence/llm/llm.types.ts`) — NEW:
- `ToolCallingChainConfig` — `{ tools: StructuredTool[], systemPrompt?, maxIterations?, model? }`
- `ToolChainInput` — `{ messages: BaseMessage[] }`

**`ChunkingPipeline`**
- `run(batch)` — Async-generator that yields `DataChunk[]` by applying configured strategies

**`CapabilityManager`**
- `getAll()` — List all registered capabilities
- `getByName(name)` — Get capability by name
- `executeAll(input)` — Run all capabilities, collect results + errors
- `executeByName(name, input)` — Run one capability

**`CapabilitiesModule`** (`src/intelligence/capabilities/capabilities.module.ts`) — UPDATED:
- Registers 4 capabilities in execution order: KG extractor → V1 extractor → V2 extractor → suggestions extractor
- Imports: `InsightsExtractionModule`, `KnowledgeGraphExtractionModule`, `InsightsExtractionV2Module`, `SuggestionsCapabilityModule` (empty `MergeModule` removed)
- Exports: `CapabilityManager`, `KnowledgeGraphExtractionModule`, `InsightsExtractionV2Module`, `SuggestionsCapabilityModule`

**`IntelligenceModule`** (`src/intelligence/intelligence.module.ts`) — UPDATED:
- Imports: `ContextModule`, `LlmModule`, `ChunkingModule`, `CapabilitiesModule`, `StoreModule`, `MergeModule`, `ToolsModule`, `RepositoriesModule`, `JobsModule`, `SuggestionsModule`
- Exports: `ContextModule`, `StoreModule`, `IntelligenceEngineService`, `SuggestionsModule`

#### Capabilities

**Knowledge Graph Extraction** (`src/intelligence/capabilities/knowledge-graph-extraction/`) — REWRITTEN (direct structured extraction):
- `KnowledgeGraphExtractionCapability` — Direct structured KG extraction (no longer agentic tool-calling)
  - One LLM call via `LlmService.createGraphLLM()`, validated against `KnowledgeGraphSchema` (Zod)
  - Writes entities/relationships directly to Neo4j via `Neo4jService` (injected `@Optional`, no-op if Neo4j down)
  - Extracts `extractJsonString()` from the raw LLM response
  - Returns `CapabilityResult` with empty insights array (doesn't produce business insights)
- **`kg-schema.ts`** — NEW: `KnowledgeGraphSchema`/`KnowledgeGraphData` Zod schema for structured output (`entities[]`, `relationships[]` with `metadata`, `relationshipType`)
- `kg-extraction-schema.ts` — DELETED
- `KgExtractionPrompt` — System prompt describing entity types (Person, Team, Project, Service, Repository, Document, Ticket, Channel) and relationship types (WORKS_ON, OWNS, DEPENDS_ON, REFERENCES, BELONGS_TO, MENTIONS)

**Insight Extraction V2** (`src/intelligence/capabilities/insights-extraction-v2/`):
- `InsightExtractionCapabilityV2` — Enhanced extraction using KG + search tools for disambiguation
  - Uses `GraphToolsService.getTools(orgId)` (Neo4j-backed) and `SearchToolsService.getTools(orgId, userId)` for entity/message/insight lookup
  - Enhanced batch owner resolution (`resolveOwnersBatch()`):
    1. Exact match by `platformUserId` in `PlatformUserMapping`
    2. Exact match by `platformUsername` in `PlatformUserMapping`
    3. Fuzzy Levenshtein distance against `PlatformUserMapping` user names (firstName, lastName, combinations)
    4. Exact match against Organization users (by id, email, email username, firstName, lastName)
    5. Fuzzy match against Organization users
  - Configurable max distance via `OWNER_RESOLVER_MAX_DISTANCE` (default 1)
  - Supports `excludeAuthor`, `broadcasted`, `priority`, `deadline` fields
  - **Broadcast accuracy fix:** `broadcasted` is now true ONLY if the LLM explicitly set it, or if no owners were specified AND no unresolved refs remain (previously auto-broadcasted on all-excluded)

**Suggestions Capability** (`src/intelligence/capabilities/suggestions/`):
- `SuggestionsCapability` — Generates context summaries and action options from insights with KG context
  - Skips when no insights in context (no-op for empty pipelines)
  - Uses `GraphToolsService` for KG queries
  - Persists suggestions to `insight_suggestions` table via `InsightSuggestionRepository.createMany()`
  - Each suggestion can have multiple action options with label, description, actionType, risk, reasoning

**`InsightPersistenceService`** (`src/intelligence/store/insight-persistence.service.ts`) — UPDATED:
- `persistAll(insights, organizationId)` — Batch create/update insights; publishes `INSIGHT_VERSIONS_CREATED` event with `{versionId, content}[]` for background embedding generation
- `persist(insight, organizationId)` — Single insight (passes `priority`, `deadline`, `excludedUserIds`)
- `triggerMissingEmbeddingsBackfill()` — On module init, finds up to 50 `insight_versions` with NULL embeddings and publishes `EMBEDDINGS_GENERATE`

**`InsightEmbeddingListener`** (`src/intelligence/store/insight-embedding.listener.ts`) — NEW:
- Listens to `INSIGHT_VERSIONS_CREATED` and `EMBEDDINGS_GENERATE`
- Embeds batch via `EmbeddingService.embedDocuments()`, persists via `EmbeddingRepository.upsert()`
- Retries up to 3 attempts with exponential backoff (1s, 2s, 4s)

**`IntelligenceEngineService`** — ingestion trigger (moved to `src/intelligence/triggers/envelopes-ingested.listener.ts`):
- `EnvelopesIngestedListener` — `@OnEvent(Events.ENVELOPES_INGESTED)`:
  - Receives `EnvelopesIngestedEvent` with `organizationId`, `envelopeIds`, `isBackfill`; skips when 0 envelopes
  - For backfill: passes `envelopeIds`, sets `progressable: true`
  - For streaming: passes collected `envelopeIds` for scoped processing

---

### Types (`src/types/`)

**`insight.types.ts`**
- `InsightType` — `'TASK' | 'URGENCY' | 'INFO' | 'DECISION'`
- `InsightActionStatus` — `'PENDING' | 'NOTED' | 'DONE' | 'BLOCKED' | 'IN_REVIEW' | 'DECIDED' | 'DELEGATED' | 'DELAYED' | 'HIDDEN'`
- `INSIGHT_ACTION_MAP` — Maps each `InsightType` to allowed action statuses
- `Insight` — Core insight interface: `id, type, content, owners, envolopsRef, broadcasted, version, status, latestVersionId, sourcePlugin, groupId, channelId, topicId, createdAt, unresolvedOwnerRefs, priority?, deadline?, excludedUserIds?`
  - `excludedUserIds?: string[]` — User IDs excluded from ownership (when `excludeAuthor` is true)
- `UnresolvedOwnerRef` — `{ platformUserId, platformUsername, pluginName }`

**`envelope.types.ts`**
- `EnvelopeData` — `{ id, sourcePlugin, sourceId, type, hasAttachment, authorId, occurredAt, organizationId, status, permissions }`
- `MessagePayloadData` — `{ id, type, content, groupId, channelId, replyTo, topicId, reactions, pinned, editedDate, entities, rawPayload }`
- `EnvelopeWithPayload` — `{ envelope: EnvelopeData, payload: Payload }`

---

### Embeddings (`src/intelligence/embeddings/`) — NEW

**`EmbeddingService`** (`src/intelligence/embeddings/embedding.service.ts`):
- `onModuleInit()` — Initializes embedder based on `embeddings.provider` config
- `embed(text)` — Embed single query string → `number[]`
- `embedDocuments(texts)` — Embed batch of documents → `number[][]`
- Supported providers: `openai` (default, `text-embedding-3-small`), `ollama` (`nomic-embed-text`), `google-genai` (`text-embedding-004`)
- Config via `embeddings.*` namespace; embedding column is unconstrained `vector` (any dimensions, e.g. 768 for nomic)

**`EmbeddingsModule`** — New module, exports `EmbeddingService`

**pgvector setup** (`prisma/app-db/init-vector.ts`) — NEW: creates `vector` extension, ensures `embedding` column is unconstrained `vector`, creates IVFFlat index (`vector_cosine_ops`, 100 lists); wired into `prisma:push` and new `db:setup` script

---

### Knowledge Graph (`src/graph/`) — NEW

**`Neo4jService`** (`src/graph/neo4j.service.ts`):
- Wraps `neo4j-driver` (Driver) + LangChain `Neo4jGraph` for LLM integrations
- `onModuleInit()` — Connects via `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD` env (defaults: `bolt://localhost:7687`, `neo4j`, `pn_console_password`); non-fatal if unavailable
- `getDriver()` / `getGraph()` — Access raw driver / LangChain wrapper
- `executeRead(cypher, params)` / `executeWrite(cypher, params)` — Cypher with session management, logging, timing; no-op (returns `[]`) when not connected
- `onModuleDestroy()` — Closes driver

**`GraphModule`** — `@Global()` module; imports `ConfigModule`, provides/exports `Neo4jService`; registered in `app.module.ts`

---

### Knowledge Graph Extraction Capability (`src/intelligence/capabilities/knowledge-graph-extraction/`) — REWRITTEN

**`KnowledgeGraphExtractionCapability`** (`src/intelligence/capabilities/knowledge-graph-extraction/knowledge-graph-extraction.capability.ts`):
- Implements `ICapability` with name `'knowledge-graph-extractor'`
- `execute(input)` — Agentic KG extraction:
  - Maps envelopes to messages with sourcePlugin, content, authorId, group/channel/topic IDs
  - Uses `GraphToolsService.getTools(orgId)` for graph operations
  - Uses `LlmService.createGraphLLM()` for dedicated graph LLM
  - Uses `LlmService.createToolChain()` for multi-iteration tool calling
  - Retries on failure (`LLM_MAX_RETRIES`, default 3)
  - Returns empty insights array (no business insights produced)

**`KgExtractionSchema`** (`src/intelligence/capabilities/knowledge-graph-extraction/kg-extraction-schema.ts`):
- `ENTITY_TYPES` — `['Person', 'Team', 'Project', 'Service', 'Repository', 'Document', 'Ticket', 'Channel']`
- `RELATIONSHIP_TYPES` — `['WORKS_ON', 'OWNS', 'DEPENDS_ON', 'REFERENCES', 'BELONGS_TO', 'MENTIONS']`
- `ExtractedEntitySchema` — Zod schema with `name`, `type`, `metadata?`
- `ExtractedRelationshipSchema` — Zod schema with `sourceEntityName`, `sourceEntityType`, `targetEntityName`, `targetEntityType`, `type`, `metadata?`
- `KnowledgeGraphExtractionResultSchema` — `{ entities[], relationships[] }`
- Exported types: `ExtractedEntity`, `ExtractedRelationship`, `KnowledgeGraphExtractionResult`

**`KgExtractionPrompt`** (`src/intelligence/capabilities/knowledge-graph-extraction/kg-extraction-prompt.ts`):
- System prompt instructs LLM agent to analyze messages and maintain enterprise knowledge graph via tool calls
- Entities: Person, Team, Project, Service, Repository, Document, Ticket, Channel
- Relationships: WORKS_ON, OWNS, DEPENDS_ON, REFERENCES, BELONGS_TO, MENTIONS
- Tools: `search_graph`, `create_entities`, `create_relationships`

**`KnowledgeGraphExtractionModule`** — New module registering the capability

---

### Insight Extraction V2 Capability (`src/intelligence/capabilities/insights-extraction-v2/`) — NEW

**`InsightExtractionCapabilityV2`** (`src/intelligence/capabilities/insights-extraction-v2/insight-extraction-v2.capability.ts`):
- Implements `ICapability` with name `'insights-extractor-v2'`
- `execute(input)` — Extracts insights with KG tool integration:
  - Loads all `PlatformUserMapping` with user details + all organization users
  - Maps platform → app user for author exclusion
  - Uses `GraphToolsService.getTools(orgId)` for disambiguation
  - Uses `LlmService.createToolChain()` for tool-calling iteration
  - Batch owner resolution via `resolveOwnersBatch()`:
    - 5-tier resolution: exact platformUserId → exact username → fuzzy user name → exact org user → fuzzy org user
  - Handles `excludeAuthor` → resolves platform author IDs to app user IDs, filters excluded
  - Auto-sets `broadcasted: true` when all owners excluded
  - Configurable retries (`LLM_MAX_RETRIES`, default 3)

**V2 Extraction Prompt** (`src/intelligence/capabilities/insights-extraction-v2/insight-extraction-v2-prompt.ts`):
- System prompt includes KG integration instructions for disambiguation
- Insight categories: TASK, INFO, URGENCY, DECISION
- Output format: `{ updatedInsights[], newInsights[] }` with id, type, content, owners, envolopsRef, broadcasted, excludeAuthor, priority, deadline

---

### Suggestions (`src/intelligence/suggestions/`) — NEW

**`SuggestionsController`** — `@Controller('suggestions')`:
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/suggestions` | JWT | Get AI suggestions for authenticated user (optional `?status=` filter) |
| GET | `/suggestions/insight/:insightId` | JWT | Get or auto-generate AI suggestions for a specific insight |
| POST | `/suggestions/generate/:insightId` | JWT | Trigger on-demand AI suggestion generation for an insight |
| PATCH | `/suggestions/:id/status` | JWT | Update suggestion status |

**`SuggestionsService`** (`src/intelligence/suggestions/suggestions.service.ts`):
- `getUserSuggestions(userId, organizationId?, status?)` — List suggestions for user's owned or broadcasted insights
- `getInsightSuggestions(insightId, organizationId?)` — Get suggestions for specific insight (with org access check)
- `getOrGenerateForInsight(insightId, userId, organizationId?)` — Returns existing suggestions or auto-generates on first access
- `generateForInsight(insightId, userId, organizationId?)` — Creates synthetic chunk and invokes `suggestions-extractor` capability
- `updateStatus(id, status)` — Updates status; on ACCEPTED/COMPLETED, resets peer suggestions to PENDING

**DTOs:**
- `UpdateSuggestionStatusDto` — `{ status: SuggestionStatus }` (validated via `@IsEnum`)

**`SuggestionsModule`** — Imports `RepositoriesModule`, `CapabilitiesModule`; exports `SuggestionsService`

---

### Suggestions Capability (`src/intelligence/capabilities/suggestions/`) — NEW

**`SuggestionsCapability`** (`src/intelligence/capabilities/suggestions/suggestions.capability.ts`):
- Implements `ICapability` with name `'suggestions-extractor'`
- `execute(input)` — Analyzes extracted insights with KG context:
  - Skips when no insights in context (history is empty)
  - Uses `GraphToolsService` for KG queries
  - Calls LLM with tool-calling chain for context + options generation
  - Parses structured output via `SuggestionsResultSchema` (Zod)
  - Persists generated suggestions to `insight_suggestions` table
  - Supports action types: RECOMMENDATION, RISK_MITIGATION, NEXT_STEP, REASSIGN, ESCALATE, DELEGATE, DISMISS

**Schema** (`src/intelligence/capabilities/suggestions/suggestions-schema.ts`):
- `OptionSchema` — `{ label, title, description?, actionType?, risk?, reasoning? }`
- `SuggestionItemSchema` — `{ insightId, title, contextSummary[], options[] }`
- `SuggestionsResultSchema` — `{ suggestions: SuggestionItem[] }`

---

### Knowledge Graph Tools (`src/intelligence/tools/`) — NEO4j-BACKED

**`GraphToolsService`** (`src/intelligence/tools/graph-tools.service.ts`):
- `getTools(organizationId?)` — Returns 6 `StructuredTool` instances backed by `Neo4jService` Cypher:
  - `search_graph` — Search entities by name/keyword/role, optional type filter (`labels(e)[0] = $type`); max 20 results
  - `get_entity` — Get entity detail + direct relationships by UUID
  - `get_neighbors` — BFS neighborhood traversal up to `GRAPH_MAX_NEIGHBOR_DEPTH` (default 2, clamped 1..depth)
  - `create_entities` — Batch MERGE on `name`+`orgId` (role metadata, generated UUIDs); returns IDs even without Neo4j
  - `update_entities` — Batch update name/type/role metadata
  - `create_relationships` — Batch MERGE relationships between entity IDs
- `@Optional()` injects `Neo4jService`; tools return empty/error JSON when driver not connected
- `GRAPH_MAX_NEIGHBOR_DEPTH` — config key, default 2

**`SearchToolsService`** (`src/intelligence/tools/search-tools.service.ts`) — NEW:
- `getTools(organizationId?, userId?)` — Returns 3 `StructuredTool` instances:
  - `search_raw_messages` — Keyword search over raw ingested envelopes via `EnvelopeRepository.searchMessages()` (default 15)
  - `search_insights` — Keyword search over extracted insights via `InsightRepository.searchInsights()` (default 15)
  - `retrieve_relevant_insights` — Vector RAG: `EmbeddingService.embed()` + `EmbeddingRepository.searchSimilar()` at 0.45 threshold (default 10)

**`ToolsModule`** — New module, imports `RepositoriesModule` + `EmbeddingsModule`, exports `GraphToolsService`, `SearchToolsService`

---

### Config Namespaces (`src/config/`)

| Namespace | Key | Default | Description |
|-----------|-----|---------|-------------|
| `app` | `port` | `3000` | Server port |
| | `frontendUrl` | `http://localhost:1420` | Frontend URL |
| `database` | `rawDbUrl` | env `DATABASE_URL` | Raw DB URL |
| | `appDbUrl` | env `APP_DATABASE_URL` | App DB URL |
| `jwt` | `secret` | env `JWT_SECRET` | JWT signing secret |
| | `expiration` | `'7d'` | JWT expiration |
| `llm` | `provider` | env `LLM_PROVIDER` | LLM provider |
| | `model` | env `LLM_MODEL` | LLM model |
| | `apiKey` | env `LLM_API_KEY` | API key |
| | `baseUrl` | env `LLM_BASE_URL` | Base URL (ollama) |
| | `maxRetries` | `3` | LLM retry count |
| | `ownerResolverMaxDistance` | `3` | Levenshtein distance for fuzzy name matching |
| | `graphProvider` | `llm.provider` | Graph LLM provider |
| | `graphModel` | `llm.model` | Graph LLM model |
| | `graphApiKey` | `llm.apiKey` | Graph LLM API key |
| | `graphBaseUrl` | `llm.baseUrl` | Graph LLM base URL (ollama) |
| | `maxToolIterations` | `15` | Max tool-calling iterations (`LLM_MAX_TOOL_ITERATIONS`) |
| `embeddings` | `provider` | `'openai'` | Embedding provider (`openai`/`ollama`/`google-genai`) |
| | `model` | `'text-embedding-3-small'` | Embedding model |
| | `dimensions` | `1536` | Embedding vector dimensions (768 for nomic-embed-text) |
| | `apiKey` | `` | Embedding API key (falls back to `LLM_API_KEY`) |
| | `baseUrl` | `'http://localhost:11434'` | Embedding base URL (ollama only) |
| `oauth` | `google` | env vars | Google OAuth client config |
| | `microsoft` | env vars | Microsoft OAuth client config |
| | `sso` | env vars | SSO OIDC client config |
| `smtp` | `host` | `'localhost'` | SMTP host |
| | `port` | `1025` | SMTP port |
| | `from` | `'noreply@mosaid.com'` | From address |
| `telegram` | `connectionRetries` | `5` | TG connection retries |
| | `useWSS` | `true` | Use WebSocket for MTProto |
| | **~~`backfillMode`~~** | — | **Moved to `ingestion` namespace** |
| | **~~`backfillBatchSize`~~** | — | **Moved to `ingestion` namespace** |
| | `backfillOffsetId` | `1` | Starting offset for backfill |
| | `defaultTopicId` | `1` | Default topic ID |
| | `topicStoreBasePath` | `~/.pn-console/plugins/telegram` | Topic store file path |
| | `topicStoreFileSuffix` | `'__topics.json'` | Topic store file suffix |
| `engine` | `previousInsightLimit` | `5` | Previous insights to pass to LLM |
| | **`insightDeadlineWarningDays`** | **`3`** | **Deadline warning threshold (days)** |
| **~~`streaming`~~** | — | — | **Removed — config folded into `ingestion` namespace** |
| `context` | `defaultInsightLimit` | `20` | Default previous insights limit |
| | `windowMinMessages` | `1000` | Min messages per window |
| `chunking` | `minChunkMessages` | `30` | Min messages per chunk |
| | `maxChunkMessages` | `60` | Max messages per chunk |
| | `timeGapMinutes` | `30` | Time gap threshold |
| | `maxWindowMinutes` | `240` | Max window duration |
| | `partitionStrategy` | `[source, group-id, channel-id, daily]` | Order of partitioners (topic-id disabled) |
| `ingestion` | `backfillDayThreshold` | `60` | Max days of history for backfill |
| | **`backfillMode`** | **`'last'`** | **`'first'` or `'last'` — moved from `telegram`** |
| | **`backfillBatchSize`** | **`100`** | **Chunk size — moved from `telegram`** |
| | **`dbBatchSize`** | **`10`** | **DB flush batch size** |
| | **`dbBatchWindowMs`** | **`5000`** | **DB flush window (ms)** |
| | **`providerStreamFlushIntervalMs`** | **`5000`** | **Provider stream flush interval (ms)** |
| **~~`redis`~~** | — | — | **Removed — replaced by `IEventBus`/`ILockManager` abstractions** |

**Environment variables (`LLM_*` additional):**
- `LLM_GRAPH_PROVIDER`, `LLM_GRAPH_MODEL`, `LLM_GRAPH_API_KEY`, `LLM_GRAPH_BASE_URL` — Graph-specific LLM config (optional, falls back to main LLM)
- `LLM_MAX_TOOL_ITERATIONS` — Default 15, max tool-calling iterations per invocation
- `GRAPH_MAX_NEIGHBOR_DEPTH` — Default 2, max BFS depth for neighborhood queries
- `NEO4J_URI` (default `bolt://localhost:7687`), `NEO4J_USER` (default `neo4j`), `NEO4J_PASSWORD` (default `pn_console_password`) — Neo4j connection for the knowledge graph

---

### Repositories (`src/repositories/`)

| Repository | DB | Key Methods |
|-----------|-----|-------------|
| `InsightRepository` | AppDb | `create`, `update`, `getAll`, `getAllByOrganizationId`, `findByScope`, `findByOwnerId` (with status filter, deadline-based priority boost), `findById`, `findVersionsByInsightId`, `findVersionById`, `findVersionEnvelopeRefs`, `getLatestVersionId`, `searchInsights`. `create()`/`update()` support `excludedUserIds`; **owner IDs and unresolved owner refs are deduplicated before persist** |
| `InsightActionRepository` | AppDb | `upsert` (insight version owner status), `upsertPriority` (insight version owner priority) |
| `EnvelopeRepository` | RawDb | `createManyWithPayload` (dedup by sourcePlugin+sourceId), `markStatus`, `findByIds`, `findRecent`, `findIdsBySourcePlugin`, `count`, **`searchMessages(query, limit?)` — NEW: keyword search over envelope payloads (insensitive contains)** |
| `PlatformUserMappingRepository` | AppDb | `create` (auto-resolves unresolved owners), `findByPlatformUser`, `findByAppUser`, `findByPluginName`, `findWithUser`, `upsert`, `delete` |
| `PluginConfigRepository` | AppDb | `findUnique` (60s TTL cache), `findMany`, `upsert`, `update`, `updateSessionString`, `clearSessionString`, `remove` — **NEW: in-memory cache via optional `ICacheStore` (`CACHE_STORE_TOKEN`), invalidated on writes** |
| `CapabilityFailureRepository` | RawDb | `create`, `createMany`, `findByOrganization`, `markResolved` |
| `JobRepository` | AppDb | `create`, `findById`, `findByUserId` (with status filter, orderBy desc, limit 50), `update` |
| `UserRepository` | AppDb | `findById`, `findByOrganization(organizationId)` — Find all users in an organization for owner resolution |
| `UnresolvedOwnerRepository` | AppDb | `create`, `createMany`, `findByInsightVersionId`, `findByPluginName`, `findAllWithUsername`, `findByPlatformUserId`, `findByPlatformUsername`, `deleteByInsightVersionId`, `delete`, `deleteMany` |
| `ActiveChatListenerRepository` | AppDb | `findByPluginAndChat`, `findAllActive`, `subscribe`, `unsubscribe`, `updateHeartbeat`, `findByPluginName`, `findLockedBy`, `releaseListener`, `claim`, `removeByPluginName` |
| **`EmbeddingRepository`** | AppDb | **`upsert(insightVersionId, embedding)`, `searchSimilar(embedding, limit, userId?, minSimilarity?)` (latest-version join + vector-dimension check), `findByFilters(userId, limit, filters)` (structured, no embedding), `deleteByInsightVersionId`, `findNullEmbeddings(limit?)` (backfill)** |
| **`InsightSuggestionRepository`** | AppDb | **`create(data)`, `createMany(records)`, `findById(id)`, `findByInsightId(insightId)`, `findByOrganizationId(orgId, options?)`, `findByUser(userId, orgId?, options?)`, `updateStatus(id, status)`, `deleteByInsightId(insightId)`, `delete(id)`** |

> **Removed:** `EntityRepository` and `RelationshipRepository` (PostgreSQL KG storage) — knowledge graph moved to Neo4j (`src/graph/`)

---

### Prisma Services (`src/prisma/`)

| Service | DB | Purpose |
|---------|-----|---------|
| `RawDbService` | Raw DB | Ingestion data (envelopes, payloads, cursors, capability failures) |
| `AppDbService` | App DB | Auth, insights, plugin configs, user mappings, jobs, chat messages |
| `PrismaModule` | Both | Global module, re-exports both DB services |
