# Architecture

## Overview

`pn-console-api` is a **NestJS 11** backend server that powers the PN Console desktop app. It exposes a REST API (port 3000) with global prefix `/api/`. Authentication is JWT-based with a global guard.

```
┌──────────────────┐     HTTP      ┌──────────────────────────────┐
│  pn-console-app  │ ──────────►   │  pn-console-api (port 3000)  │
│  (Tauri + Vue 3) │               │                              │
└──────────────────┘               │  Global prefix: /api         │
                                    │  Swagger: /api/docs          │
                                    └──────────────────────────────┘
```

## Directory Layout

```
pn-console-api/
├── prisma/
│   ├── app-db/          # App DB schema, migrations, seed
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── raw-db/          # Raw DB schema
│       └── schema.prisma
├── src/
│   ├── auth/            # Authentication & authorization
│   │   ├── dto/         #   Request DTOs
│   │   ├── guards/      #   JWT guard
│   │   └── strategies/  #   Passport strategies (JWT, Google, Microsoft, SSO)
│   ├── chat/            # Chat history & context-aware streaming responses
│   │   ├── chat.controller.ts   #   HTTP endpoint (SSE)
│   │   └── dto/         #   SendMessageDto
│   ├── common/          # Shared utilities
│   │   ├── providers/   #   NEW: IEventBus, ILockManager, ICacheStore abstractions
│   │   │   ├── cache-store/       #     ICacheStore + InMemoryCacheStore
│   │   │   ├── event-bus/         #     IEventBus + InMemoryEventBus
│   │   │   ├── lock-manager/      #     ILockManager + InMemoryLockManager
│   │   │   └── common-providers.module.ts
│   │   ├── decorators/  #   @Public() decorator
│   │   └── filters/     #   Global exception filter
│   ├── config/          # Namespaced config registrations (10 namespaces, removed streaming + redis)
│   ├── demo/            # Demo/testing controllers
│   ├── ingestion/       # Ingestion pipeline
│   │   ├── events/      #   Ingestion events (PluginActivated, PluginDeactivated,
│   │   │                #     PluginConfigUpdated, EnvelopesIngested)
│   │   ├── plugins/     #   Plugin system
│   │   │   ├── common/          #   NEW: BasePluginProvider abstract class
│   │   │   ├── dto/             #   PluginUpdateChatsDto, ChatItemDto
│   │   │   ├── interfaces/      #   IPlugin, PluginContext, ProviderConfig interfaces
│   │   │   ├── services/        #   PluginManagerService, PluginContextService,
│   │   │   │                    #   PluginActivationService, PluginConfigService (NEW)
│   │   │   ├── types/           #   WorkerState type
│   │   │   ├── utils/           #   NEW: provider-utils (extractProviderChats, isSessionExpired, etc.)
│   │   │   └── providers/       #   NEW: moved from telegram/
│   │   │       └── telegram/    #   Telegram plugin implementation
│   │   │           ├── services/  #   TelegramBackfillService, TelegramStreamService (NEW),
│   │   │           │              #   TelegramPluginService, TelegramClientFactory, TelegramTopicStore
│   │   │           ├── types/     #   TelegramMessageRaw, etc.
│   │   │           └── utils/     #   normalizer, telegram-utils
│   │   ├── workers/     #   NEW: replaced streaming + old plugin services
│   │   │   ├── batch-buffer.service.ts    #   Moved from streaming/
│   │   │   ├── ingestion-worker.service.ts #   Moved from plugins/services/
│   │   │   ├── worker-manager.service.ts  #   Refactored from plugins/services/
│   │   │   ├── worker-recovery.service.ts #   NEW
│   │   │   └── workers.module.ts          #   NEW
│   │   └── ~~redis/~~       #   REMOVED — replaced by CommonProvidersModule
│   │   └── ~~streaming/~~   #   REMOVED — replaced by workers/
│   ├── insights/        # Insights CRUD API
│   │   └── dto/
│   ├── intelligence/    # Intelligence engine
│   │   ├── capabilities/      #   Capability system
│   │   │   └── insights-extraction/
│   │   ├── chunking/          #   Chunking pipeline
│   │   ├── context/           #   Context building
│   │   ├── llm/               #   LLM abstraction (with streaming support)
│   │   ├── merge/
│   │   ├── store/             #   Insight persistence
│   │   ├── tools/
│   │   └── triggers/          #   Event-driven processing
│   ├── jobs/            # Job tracking infrastructure
│   │   ├── dto/         #   JobResponseDto, JobsQueryDto
│   │   └── events/      #   Intelligence-job events
│   ├── mail/            # Mail service (nodemailer)
│   ├── prisma/          # Prisma services
│   │   ├── app-db/
│   │   └── raw-db/
│   ├── profile/         # User profile metadata
│   │   └── dto/         #   ProfileMetaDataDto
│   ├── repositories/    # Data access layer (11 repositories)
│   └── types/           # Shared TypeScript types
├── db/init/             # SQL init scripts
├── test/                # E2E tests + jest-integration.json
├── azure-pipelines.yml  # PR validation pipeline
└── docker-compose.yml
```

## Two-Database Design

The API manages **two separate PostgreSQL databases** with distinct schemas, plus a **Neo4j graph database** for the enterprise knowledge graph:

| DB | Schema File | Env Var | Purpose |
|----|-------------|---------|---------|
| Raw DB | `prisma/raw-db/schema.prisma` | `DATABASE_URL` | Ingestion data (envelopes, message payloads, cursors, capability failures) |
| App DB | `prisma/app-db/schema.prisma` | `APP_DATABASE_URL` | Business data (users, insights, jobs, chat messages, conversations, plugin configs, user mappings, active chat listeners) |
| Neo4j | — | `NEO4J_URI` | Enterprise knowledge graph (entities, relationships) — via `GraphModule` |

Each generates its own Prisma client (`generated/raw-db-client`, `generated/app-db-client`). The split keeps ingestion throughput isolated from app-level queries. Neo4j holds the knowledge graph that was previously in PostgreSQL `entities`/`relationships` tables.

## Module Dependency Graph

```
AppModule
├── ConfigModule (global, 10 namespaces — removed streaming, redis)
├── EventEmitterModule
├── CommonProvidersModule (NEW: global, IEventBus/ILockManager/ICacheStore)
├── PrismaModule (global)
│   ├── RawDbModule
│   └── AppDbModule
├── GraphModule (NEW: global, Neo4jService)
├── AuthModule
│   ├── AppDbModule
│   ├── PassportModule
│   ├── JwtModule (async)
│   └── MailModule
├── IngestionModule (replaced old PluginsModule import)
│   ├── PluginsModule (PluginActivationService, PluginConfigService, PluginManagerService)
│   ├── WorkersModule (NEW: WorkerManager, WorkerRecoveryService)
│   ├── TelegramPluginModule
│   ├── RepositoriesModule
│   ├── RawDbModule
│   ├── IntelligenceModule
│   └── CommonProvidersModule
├── (~~PluginsModule~~ — removed from AppModule, imported via IngestionModule)
├── (~~RedisModule~~ — REMOVED, replaced by CommonProvidersModule)
├── IntelligenceModule
│   ├── ContextModule
│   ├── LlmModule
│   ├── ChunkingModule
│   ├── CapabilitiesModule
│   ├── StoreModule (adds InsightEmbeddingListener)
│   ├── (~~MergeModule~~ — REMOVED, was empty)
│   ├── EmbeddingsModule (NEW)
│   ├── ToolsModule (NEW: GraphToolsService + SearchToolsService)
│   ├── SuggestionsModule (NEW)
│   ├── RepositoriesModule
│   └── JobsModule
├── MailModule
├── DemoModule
│   ├── RepositoriesModule
│   ├── CapabilitiesModule
│   └── StoreModule
├── InsightsModule
│   ├── AuthModule
│   └── RepositoriesModule
├── JobsModule
│   └── RepositoriesModule
├── RolesModule (NEW: RBAC roles management)
│   └── AppDbModule
├── TeamsModule (NEW: Teams & team members management)
│   ├── AppDbModule
│   └── RolesModule
├── ProfileModule
│   └── RepositoriesModule
├── ChatModule
│   ├── AppDbModule
│   ├── RepositoriesModule
│   ├── LlmModule
│   └── EmbeddingsModule (NEW — for RAG context)
```

## Data Flow

### Plugin Activation (refactored flow)

```
HTTP POST /api/plugins/:name/activate
  → PluginsController.activate()
    → PluginActivationService.activate(userId, pluginName)
      → PluginConfigRepository.findUnique() — validate config exists
      → PluginManagerService.validateAuth() — check session valid
      → ActiveChatListenerRepository.subscribe() — register per chat
      → IEventBus.publish('plugin.activated', PluginActivatedEvent)
        → WorkerManager.subscriber starts workers:
          WorkerManager.start(config)
            → extractProviderChats(config.config)
            → For each chat: startWorker(pluginName, chatId, config)
              → ILockManager.acquire(resource, instanceId) — distributed lock
              → IngestionWorker.run()
                → plugin.backfill(opts, context, signal) — historical catch-up
                  → BatchBuffer accumulates (ingestion.dbBatchSize, ingestion.dbBatchWindowMs)
                  → context.storeEnvelopes() per flush
                  → context.saveCursor()
                → [backfill complete]
                → IEventBus.publish(Events.ENVELOPES_INGESTED, {isBackfill: true})
                  → EnvelopesIngestedListener → IntelligenceEngineService.run()
                → plugin.startStream(opts, context, signal) — live listening
                  → BatchBuffer accumulates
                  → context.storeEnvelopes() per flush
                  → context.saveCursor()
                  → IEventBus.publish(Events.ENVELOPES_INGESTED, {isBackfill: false})
```

### WorkerManager Multi-Instance Coordination

```
Instance starts → onApplicationBootstrap()
  → ActiveChatListenerRepository.findAllActive()
  → For each active listener: ILockManager.acquire(resource, instanceId)
    → Lock acquired → ActiveChatListenerRepository.claim() → startWorker()
    → Lock held by another → skip (other instance handles it)

Event subscription → onApplicationBootstrap()
  → IEventBus.subscribe(Events.PLUGIN_ACTIVATED, ...) — start workers for new activation
  → IEventBus.subscribe(Events.PLUGIN_DEACTIVATED, ...) — stop all workers for plugin
  → IEventBus.subscribe(Events.PLUGIN_CONFIG_UPDATED, ...) — syncWorkersForConfig()

Dynamic worker syncing → syncWorkersForConfig(config)
  → extractProviderChats(config.config) — get current chat list
  → stop workers for chats removed from config
  → start workers for chats added to config

Instance shuts down → onApplicationShutdown()
  → abort() all workers
  → ILockManager.release() for all claimed resources

Session expired detected → WorkerManager detects error in worker
  → WorkerRecoveryService.recoverFromSessionExpiry()
    → ConfigRepository.update() — set status=ERROR, clear session string
    → onNewOwnerConfig callback — restart worker when config updated
```

### Plugin Deactivation

```
HTTP POST /api/plugins/:name/deactivate
  → PluginsController.deactivate()
    → PluginActivationService.deactivate(userId, pluginName)
      → IEventBus.publish('plugin.deactivated', PluginDeactivatedEvent)
        → WorkerManager.subscriber stops workers:
          extractProviderChats(config.config)
          For each chat: WorkerManager.stop(pluginName, chatId)
            → IngestionWorker.abort() — AbortController for backfill + stream
            → ILockManager.release(resource, instanceId)
      → ActiveChatListenerRepository.unsubscribe() per chat
      → PluginConfigRepository.update() — set status=CONFIGURED
```

### Plugin Status & Config Schema

```
HTTP GET /api/plugins/:name/status
  → PluginsController.getActivationStatus()
    → PluginActivationService.getStatus(userId, pluginName)
      → PluginConfigRepository.findUnique() — get PluginStatus
      → PlatformUserMappingRepository.findByAppUser() — get platform user info
      → WorkerManager.getState(pluginName, chatId) — per-chat WorkerState[]

HTTP GET /api/plugins/:name/config-schema
  → PluginsController.getConfigSchema()
    → PluginManagerService.getConfigSchema(name)
      → plugin.getConfigSchema() — returns ConfigFieldSchema[]

HTTP GET /api/plugins/:name/activation-requirements
  → PluginsController.getActivationRequirements()
    → PluginManagerService.getActivationRequirements(name, userId)
      → plugin.getActivationRequirements(config) — returns ActivationRequirement[]
```

### Chat Streaming Responses — MULTI-CONVERSATION

```
HTTP POST /api/chat/messages (SSE)
  → ChatController.sendMessage()
    → ChatService.resolveConversation(userId, conversationId?)
      → explicit ID (ownership-checked) | latest active conversation (30-min timeout) | new Conversation
    → SSE: {type:'metadata', conversationId} + :keepalive every 15s
    → ChatService.streamResponse(userId, conversationId, userMessage, signal)
      → getRecentHistory(userId, conversationId) [last 20]
      → ChatContextService.buildContext(userId, userMessage)
        → EmbeddingRepository.findByFilters / searchSimilar (RAG)
      → LlmService.createStreamingLLM()
      → stream tokens (yield each to SSE)
      → tx: save USER + ASSISTANT messages, auto-title conversation on 2nd message

HTTP GET /api/chat/conversations | POST /api/chat/conversations | DELETE /api/chat/conversations/:id
  → ChatService.getConversations / createConversation / deleteConversation

HTTP GET /api/chat/messages?conversationId=
  → ChatService.getHistory(userId, conversationId) → ChatMessage[] ordered by createdAt asc
```

### Intelligence Pipeline — EVENT-DRIVEN

```
[envelopes.ingested published via IEventBus]
  → EnvelopesIngestedListener (src/intelligence/triggers/)
    → skips when 0 envelopes
    → IntelligenceEngineService.run(orgId, { envelopeIds, progressable: isBackfill })
      ├── [default path]
      │   → EnterpriseContextBuilder.build()
      │     → WindowDiscoveryService.discoverWindows()  [recursive SQL]
      │     → loadEnvelopes() per window
      │   → ChunkingPipeline.run(envelopes)
      │     → [SourcePartitioner, GroupIdPartitioner, ...DailyPartitioner]
      │     → CompositeChunkingStrategy
      │   → CapabilityManager.executeAll()
      │     1. knowledge-graph-extractor → writes entities/relationships to Neo4j (non-fatal)
      │     2. insights-extractor-v2 → business insights
      │   → InsightPersistenceService.persistAll()
      │     → publish INSIGHT_VERSIONS_CREATED
      │       → InsightEmbeddingListener → embed batch → EmbeddingRepository.upsert()
      └── [job tracking] → publish job.intelligence.* events
```

### User Signup Event Flow

```
POST /api/auth/signup  (or OAuth login for new user)
  → AuthService.signup() / loginOrCreateOAuthUser()
    → db.user.create()
    → IEventBus.publish(Events.USER_SIGNED_UP, UserSignedUpEvent)
    → return JWT + user

[event 'user.signed.up']
  → SignupListener.handle(event) (try/catch-wrapped)
    ┌─────────────────────────────────────┬──────────────────────────────────────────────┐
    │ 1. assignBroadcastedInsights()      │ 2. resolveUnresolvedOwners()                │
    │   → query latest broadcasted        │   → findAllWithUsername() (UnresolvedOwner)│
    │     insight versions                │   → Levenshtein distance match on           │
    │   → filter existing assignments     │     firstName / lastName / fullName combos  │
    │   → createMany() missing ones       │     (OWNER_RESOLVER_MAX_DISTANCE, default 1)│
    │                                     │   → create() InsightVersionOwner records    │
    │                                     │   → deleteMany() resolved UnresolvedOwner   │
    └─────────────────────────────────────┴──────────────────────────────────────────────┘
```

### excludeAuthor Insight Ownership

```
LLM extraction (InsightExtractionCapabilityV2.execute())
  → LLM returns insight with: { owners: [...], broadcasted, excludeAuthor: true, envolopsRef: ["..."] }
  → InsightExtractionCapabilityV2:
      platformToAppUser = map of (platformUserId → appUserId) from PlatformUserMapping
      msgAuthors = map of (envolopId → platformAuthorId) from messages
      
      getExcludedUserIds(envolopsRef):
        For each ref in envolopsRef:
          platformAuthorId = msgAuthors.get(ref)
          appUserId = platformToAppUser.get(platformAuthorId)
          if appUserId: add to excludedUserIds set
        return [...excludedUserIds]
      
      filteredOwners = resolvedOwners.filter(id => !excludedUserIds.includes(id))
      // ACCURACY FIX: broadcasted ONLY if LLM set it, or (no owners AND no unresolved refs)
      isBroadcasted = n.broadcasted || (n.owners.length === 0 && unresolved.length === 0)
      
      return Insight { owners: filteredOwners, excludedUserIds, broadcasted: isBroadcasted }

InsightRepository.create(data):
  if broadcasted and excludedUserIds.length > 0:
    allUsers = db.user.findMany()
    ownerIds = allUsers.filter(id => !excludedUserIds.includes(id))
    storeAsBroadcasted = false  // store as per-user owners, not broadcast
  elif broadcasted:
    ownerIds = all users
  else:
    ownerIds = data.owners
  // owners + unresolved refs deduplicated before persist
```

### Insights / Profile / Jobs API

```
HTTP GET /api/insights
  → InsightsController.findAll()
    → InsightsService.findAllForUser(userId, type?, status?)
      → InsightRepository.findByOwnerId()

HTTP PATCH /api/insights/:id?action=DONE
  → InsightsController.updateActionStatus()
    → InsightsService.updateActionStatus()
      → InsightRepository.findById() (access check)
      → INSIGHT_ACTION_MAP validation
      → InsightActionRepository.upsert()

HTTP GET /api/profile/meta-data
  → ProfileController.getMetaData()
    → ProfileService.getMetaData(userId)
      → UserRepository.findById()

HTTP GET /api/jobs
  → JobsController.findAll()
    → JobService.getJobsByUser(userId, status?)
      → JobRepository.findByUserId()

HTTP GET /api/jobs/:id
  → JobsController.findOne()
    → JobService.getJob(id)
```

## Key Design Decisions

1. **Two databases** — Separates high-volume ingestion data from application data.
2. **Plugin interface** — Ingestion sources implement `IPlugin`, registered at startup via DI. Generic `IPlugin<TConfig>` for typed config parsing.
3. **Worker per chat** — Each chat gets an `IngestionWorker` with individual `AbortController` for independent lifecycle.
4. **Abstracted infrastructure** — `IEventBus`, `ILockManager`, `ICacheStore` interfaces with in-memory implementations replace previous `RedisService`. Enables swapping Redis in/out without changing consumers. Event names centralized in `Events` registry with typed `EventMap`; `IEventBus.subscribe()` supports retry/backoff for resilience.
5. **Event-driven lifecycle** — Plugin activation/deactivation/config updates flow through `IEventBus` events, decoupling `PluginActivationService` from `WorkerManager`. Worker subscriptions are tracked and cleaned up on shutdown.
6. **Dynamic worker syncing** — `WorkerManager.syncWorkersForConfig()` adds/removes workers when plugin config changes without full deactivation. Activation now requires `ACTIVE` status + session string.
7. **Event-driven intelligence** — Backfill emits `envelopes.ingested` events, triggering intelligence engine automatically (via `EnvelopesIngestedListener`, not the engine itself).
8. **Capability pattern** — LLM-based extraction runs via pluggable capabilities, executed sequentially (KG first, then V2 extraction).
9. **Chunking strategy chain** — Multiple partitioners applied in configurable order, each producing sub-chunks.
10. **Versioned insights** — Each update creates a new `InsightVersion`, preserving history. `priority` and `deadline` tracked per owner.
11. **Owner resolution** — Platform user IDs mapped to app user IDs with fuzzy fallback (Levenshtein distance). `PlatformUserMappingRepository` auto-resolves unresolved owners on create/upsert. `SignupListener` resolves orphaned unresolved owners on new user signup. Owner/unresolved refs deduplicated at persist.
12. **`organizationId` hardcoded** to `'org-1'` until multi-tenant auth is implemented.
13. **Global JWT guard** — All routes authenticated by default, `@Public()` decorator for opt-out.
14. **Neo4j as graph store** — Enterprise knowledge graph lives in Neo4j (Cypher, MERGE semantics) instead of PostgreSQL tables; `Neo4jService` fails non-fatally when Neo4j is down.
15. **Background embedding generation** — Embeddings are generated asynchronously via events (`INSIGHT_VERSIONS_CREATED` / `EMBEDDINGS_GENERATE`) with retry + startup backfill, keeping extraction pipeline fast.
