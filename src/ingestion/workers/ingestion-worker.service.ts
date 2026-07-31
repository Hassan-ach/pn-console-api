import type { IPlugin } from '../plugins/interfaces/plugin.interface';
import type { PluginContext } from '../plugins/interfaces/plugin-context.interface';
import type { PluginConfigData } from 'src/repositories/plugin-config.repository';
import type { WorkerState } from '../plugins/types/worker-state.type';
import type { IntelligenceEngineService } from 'src/intelligence/intelligence-engine.service';
import { BatchBuffer } from './batch-buffer.service';
import { EnvelopeWithPayload } from 'src/types/envelope.types';
import { IEventBus } from 'src/common/providers/event-bus/event-bus.interface';
import { Events } from 'src/common/providers/event-bus/events.registry';
import { EnvelopesIngestedEvent } from '../events/ingestion.events';
import { extractProviderChats } from '../plugins/interfaces/provider-config.interface';

export class IngestionWorker {
    private backfillAbort = new AbortController();
    private streamAbort = new AbortController();
    private state: WorkerState = {
        backfill: 'IDLE',
        stream: 'IDLE',
        startedAt: new Date(),
        flushes: 0,
    };
    private dbBatchBuffer: BatchBuffer;

    constructor(
        private pluginName: string,
        private chatId: string,
        private config: PluginConfigData,
        private pluginManager: {
            get(name: string): IPlugin | undefined;
            getContext(): PluginContext;
        },
        private intelligenceEngine?: IntelligenceEngineService,
        private eventBus?: IEventBus,
        batchOpts?: { batchSize?: number; batchWindowMs?: number },
    ) {
        const context = this.pluginManager.getContext();
        const orgId = context.resolveOrgId(this.config.userId);

        this.dbBatchBuffer = new BatchBuffer(
            batchOpts?.batchSize ?? 10,
            batchOpts?.batchWindowMs ?? 5000,
            async (batch: EnvelopeWithPayload[]) => {
                const result = await context.storeEnvelopes(
                    batch,
                    this.config.userId,
                );
                const maxId = Math.max(
                    0,
                    ...batch.map((item) => Number(item.envelope.sourceId) || 0),
                );
                if (maxId > 0) {
                    await context.saveCursor(
                        this.pluginName,
                        this.config.userId,
                        this.chatId,
                        maxId,
                    );
                }
                this.state.flushes++;

                if (result.inserted > 0) {
                    if (this.eventBus) {
                        this.eventBus.publish(
                            Events.ENVELOPES_INGESTED,
                            new EnvelopesIngestedEvent(
                                orgId,
                                this.config.userId,
                                this.pluginName,
                                this.chatId,
                                result.ids,
                                false,
                            ),
                        );
                    } else if (this.intelligenceEngine) {
                        await this.intelligenceEngine.run(orgId, {
                            envelopeIds: result.ids,
                        });
                    }
                }
            },
        );
    }

    async run(): Promise<void> {
        const plugin = this.pluginManager.get(this.pluginName);
        if (!plugin) throw new Error(`Plugin "${this.pluginName}" not found`);
        const context = this.pluginManager.getContext();

        const backfillIds = await this.runBackfill(plugin, context);
        this.state.backfill = 'COMPLETED';

        if (backfillIds.length > 0) {
            const orgId = context.resolveOrgId(this.config.userId);
            if (this.eventBus) {
                this.eventBus.publish(
                    Events.ENVELOPES_INGESTED,
                    new EnvelopesIngestedEvent(
                        orgId,
                        this.config.userId,
                        this.pluginName,
                        this.chatId,
                        backfillIds,
                        true,
                    ),
                );
            } else if (this.intelligenceEngine) {
                await this.intelligenceEngine.run(orgId, {
                    userId: this.config.userId,
                    envelopeIds: backfillIds,
                    progressable: true,
                });
            }
        }

        await this.runStream(plugin, context);
    }

    private async runBackfill(
        plugin: IPlugin,
        context: PluginContext,
    ): Promise<string[]> {
        this.state.backfill = 'RUNNING';
        const chats = extractProviderChats(this.config.config);
        const chatCfg = chats.find((c) => c.id === this.chatId);
        const limit = chatCfg?.historyLimit ?? -1;
        const insertedIds: string[] = [];

        try {
            for await (const result of plugin.backfill(
                { limit, userId: this.config.userId, chatId: this.chatId },
                context,
                this.backfillAbort.signal,
            )) {
                this.state.backfillProgress = result;
                if (result.ids?.length) {
                    insertedIds.push(...result.ids);
                }
            }
        } catch (err) {
            if (!this.backfillAbort.signal.aborted) throw err;
        }

        return insertedIds;
    }

    private async runStream(
        plugin: IPlugin,
        context: PluginContext,
    ): Promise<void> {
        this.state.stream = 'LISTENING';
        const cursor = await context.getCursor(
            this.pluginName,
            this.config.userId,
            this.chatId,
        );

        try {
            for await (const batch of plugin.startStream(
                {
                    userId: this.config.userId,
                    chatId: this.chatId,
                    cursor: cursor ? Number(cursor) : undefined,
                },
                context,
                this.streamAbort.signal,
            )) {
                for (const env of batch.envelopes) {
                    this.dbBatchBuffer.add(env);
                }
            }
        } catch (err) {
            if (!this.streamAbort.signal.aborted) throw err;
        } finally {
            await this.dbBatchBuffer.flush();
            this.state.stream = 'STOPPED';
        }
    }

    abort(): void {
        this.dbBatchBuffer.flush().catch(() => {});
        this.backfillAbort.abort();
        this.streamAbort.abort();
    }

    getState(): WorkerState {
        return { ...this.state };
    }
}
