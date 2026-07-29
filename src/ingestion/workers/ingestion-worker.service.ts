import type { IPlugin } from '../plugins/interfaces/plugin.interface';
import type { PluginContext } from '../plugins/interfaces/plugin-context.interface';
import type { PluginConfigData } from 'src/repositories/plugin-config.repository';
import type { WorkerState } from '../plugins/types/worker-state.type';
import type { IntelligenceEngineService } from 'src/intelligence/intelligence-engine.service';
import { BatchBuffer } from './batch-buffer.service';
import { EnvelopeWithPayload } from 'src/types/envelope.types';
import { IEventBus } from 'src/common/providers/event-bus/event-bus.interface';
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
    private backfillEnvelopeIds: string[] = [];
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
    ) {
        const context = this.pluginManager.getContext();
        const orgId = context.resolveOrgId(this.config.userId);

        this.dbBatchBuffer = new BatchBuffer(
            10,
            5000,
            async (batch: EnvelopeWithPayload[]) => {
                const result = await context.storeEnvelopes(
                    batch,
                    this.config.userId,
                );
                const lastId = batch[batch.length - 1]?.envelope?.sourceId;
                if (lastId) {
                    await context.saveCursor(
                        this.pluginName,
                        this.config.userId,
                        this.chatId,
                        Number(lastId),
                    );
                }
                this.state.flushes++;

                if (result.inserted > 0) {
                    if (this.eventBus) {
                        this.eventBus.publish(
                            'envelopes.ingested',
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

        const backfillPromise = this.runBackfill(plugin, context);
        const streamPromise = this.runStream(plugin, context);

        await backfillPromise;
        this.state.backfill = 'COMPLETED';

        if (this.backfillEnvelopeIds.length > 0) {
            const orgId = context.resolveOrgId(this.config.userId);
            if (this.eventBus) {
                this.eventBus.publish(
                    'envelopes.ingested',
                    new EnvelopesIngestedEvent(
                        orgId,
                        this.config.userId,
                        this.pluginName,
                        this.chatId,
                        this.backfillEnvelopeIds,
                        true,
                    ),
                );
            } else if (this.intelligenceEngine) {
                await this.intelligenceEngine.run(orgId, {
                    envelopeIds: this.backfillEnvelopeIds,
                    userId: this.config.userId,
                    progressable: true,
                });
            }
        }

        await streamPromise;
    }

    private async runBackfill(
        plugin: IPlugin,
        context: PluginContext,
    ): Promise<void> {
        this.state.backfill = 'RUNNING';
        const chats = extractProviderChats(this.config.config);
        const chatCfg = chats.find((c) => c.id === this.chatId);
        const limit = chatCfg?.historyLimit ?? -1;

        try {
            for await (const result of plugin.backfill(
                { limit, userId: this.config.userId, chatId: this.chatId },
                context,
                this.backfillAbort.signal,
            )) {
                this.state.backfillProgress = result;
                this.backfillEnvelopeIds.push(...result.ids);
            }
        } catch (err) {
            if (!this.backfillAbort.signal.aborted) throw err;
        }
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
