# Test Coverage Report — `src/ingestion/`

> Generated: 2026-07-29  
> Runner: Jest 30  
> Tests: **93 passed**, 0 failed, **11 suites**  
> Coverage scope: `src/ingestion/**/*.(t|j)s`

## Per-File Coverage

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |
|---|---|---|---|---|---|
| `src/ingestion/ingestion.module.ts` | 0 | 100 | 100 | 0 | 1-10 |
| `src/ingestion/events/ingestion.events.ts` | 36.84 | 100 | 25 | 36.84 | 5-7,13-15,29-34 |
| `src/ingestion/plugins/plugins.controller.ts` | 0 | 0 | 0 | 0 | 1-244 |
| `src/ingestion/plugins/plugins.module.ts` | 0 | 100 | 0 | 0 | 1-33 |
| `src/ingestion/plugins/common/base-plugin-provider.ts` | **85.71** | 0 | **75** | **85.71** | 68 |
| `src/ingestion/plugins/common/json-store.ts` | 82.85 | 83.33 | 77.77 | 82.75 | 21,32,41-43 |
| `src/ingestion/plugins/dto/plugin-config.dto.ts` | 0 | 0 | 100 | 0 | 1-16 |
| `src/ingestion/plugins/dto/plugin-login.dto.ts` | 0 | 0 | 100 | 0 | 1-16 |
| `src/ingestion/plugins/dto/plugin-update-chats.dto.ts` | 0 | 100 | 0 | 0 | 1-40 |
| `src/ingestion/plugins/interfaces/provider-config.interface.ts` | 100 | 100 | 100 | 100 | — |
| `src/ingestion/plugins/providers/telegram/telegram-plugin.module.ts` | 0 | 0 | 0 | 0 | 1-25 |
| `src/ingestion/plugins/providers/telegram/services/telegram-backfill.service.ts` | 11.86 | 0 | 0 | 9.25 | 24-159 |
| `src/ingestion/plugins/providers/telegram/services/telegram-client.factory.ts` | 83.33 | 58.33 | 100 | 81.25 | 34-35,50 |
| `src/ingestion/plugins/providers/telegram/services/telegram-plugin.service.ts` | 75.86 | 65.11 | 44.44 | 74.07 | 104-146,180-205 |
| `src/ingestion/plugins/providers/telegram/services/telegram-stream.service.ts` | 19.51 | 0 | 0 | 16.66 | 26-91 |
| `src/ingestion/plugins/providers/telegram/services/telegram-topic.store.ts` | 100 | 80 | 100 | 100 | 22-24 |
| `src/ingestion/plugins/providers/telegram/utils/normalizer.ts` | 100 | 100 | 100 | 100 | — |
| `src/ingestion/plugins/providers/telegram/utils/telegram-utils.ts` | **95.55** | **83.33** | **100** | **95.55** | 99-100 |
| `src/ingestion/plugins/services/plugin-activation.service.ts` | 0 | 0 | 0 | 0 | 1-212 |
| `src/ingestion/plugins/services/plugin-config.service.ts` | **89.58** | **73.07** | **87.5** | **93.18** | 34-36 |
| `src/ingestion/plugins/services/plugin-context.service.ts` | 89.18 | 80.76 | 71.42 | 87.87 | 16-19 |
| `src/ingestion/plugins/services/plugin-manager.service.ts` | 80 | 67.85 | 69.56 | 79.66 | 56-72,144,164-165,184 |
| `src/ingestion/plugins/utils/provider-utils.ts` | **80.64** | **77.27** | **100** | **78.57** | 55-57,66-68 |
| `src/ingestion/workers/batch-buffer.service.ts` | **100** | **87.5** | **100** | **100** | 25 |
| `src/ingestion/workers/ingestion-worker.service.ts` | 0 | 0 | 0 | 0 | 6-176 |
| `src/ingestion/workers/worker-manager.service.ts` | 0 | 0 | 0 | 0 | 1-238 |
| `src/ingestion/workers/worker-recovery.service.ts` | 0 | 0 | 0 | 0 | 1-62 |
| `src/ingestion/workers/workers.module.ts` | 0 | 100 | 0 | 0 | 1-19 |

## Totals by Sub-Module

| Sub-Module | % Stmts | % Branch | % Funcs | % Lines | Spec Files |
|---|---|---|---|---|---|
| `events/` | 36.84 | 100 | 25 | 36.84 | 0 |
| `plugins/` (controller + module) | 0 | 0 | 0 | 0 | 0 |
| `plugins/common/` | **83.33** | 62.5 | **76.92** | **83.33** | **1** |
| `plugins/dto/` | 0 | 0 | 100 | 0 | 0 |
| `plugins/interfaces/` | 100 | 100 | 100 | 100 | 0 |
| `plugins/providers/telegram/` (module) | 0 | 0 | 0 | 0 | 0 |
| `plugins/providers/telegram/services/` | 50.96 | 40.18 | 54.16 | 48.93 | 4 |
| `plugins/providers/telegram/utils/` | **95.74** | **85.18** | **100** | **95.74** | 2 |
| `plugins/services/` | **56.63** | **43.38** | **62.26** | **56.79** | **3** |
| `plugins/utils/` | **80.64** | **77.27** | **100** | **78.57** | **1** |
| `workers/` | **8.79** | **7.14** | **12.5** | **8.86** | **1** |

## Improvements (Before → After)

| File | Lines Before | Lines After | Δ |
|---|---|---|---|
| `batch-buffer.service.ts` | 0% | **100%** | 🟢 +100pp |
| `provider-utils.ts` | 21.42% | **78.57%** | 🟢 +57pp |
| `base-plugin-provider.ts` | 28.57% | **85.71%** | 🟢 +57pp |
| `telegram-utils.ts` | 60% | **95.55%** | 🟢 +36pp |
| `plugin-config.service.ts` | 68.18% | **93.18%** | 🟢 +25pp |

## Coverage Gaps (Worst First)

| File | % Lines | Severity |
|---|---|---|
| `plugin-activation.service.ts` | 0 | 🔴 212 uncovered lines |
| `worker-manager.service.ts` | 0 | 🔴 238 uncovered lines |
| `plugins.controller.ts` | 0 | 🔴 244 uncovered lines |
| `ingestion-worker.service.ts` | 0 | 🔴 171 uncovered lines |
| `worker-recovery.service.ts` | 0 | 🔴 62 uncovered lines |
| `telegram-backfill.service.ts` | 9.25 | 🟠 136 uncovered lines |
| `telegram-stream.service.ts` | 16.66 | 🟠 66 uncovered lines |
| `plugin-config.service.ts` | 93.18 | 🟢 remargin: 3 lines |
| `plugin-context.service.ts` | 87.87 | 🟢 good |
| `batch-buffer.service.ts` | 100 | 🟢 perfect |
| `normalizer.ts` | 100 | 🟢 perfect |
| `telegram-topic.store.ts` | 100 | 🟢 perfect |
| `provider-config.interface.ts` | 100 | 🟢 perfect |

## Spec Files (11 total)

| Spec | Tests |
|---|---|
| `batch-buffer.service.spec.ts` | 4 |
| `base-plugin-provider.spec.ts` | 5 |
| `provider-utils.spec.ts` | 16 |
| `plugin-config.service.spec.ts` | 6 |
| `telegram-utils.spec.ts` | 8 (added normalizeRawMessage) |
| `plugin-context.service.spec.ts` | 9 |
| `plugin-manager.service.spec.ts` | 15 |
| `telegram-client.factory.spec.ts` | 3 |
| `telegram-plugin.service.spec.ts` | 9 |
| `telegram-topic.store.spec.ts` | 9 |
| `normalizer.spec.ts` | 9 |

## Key Observations

- **31 new tests** added across **4 new spec files** + 1 enhanced spec.
- **Still uncovered:** heavy NestJS services with deep DI (workers/, activation service, controller, backfill/stream services) — these need integration-level testing or acceptance criteria first.
- **DTO files** report 0% statements/lines because they're pure type declarations with no executable code.
