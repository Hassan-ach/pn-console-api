import type { IPlugin } from '../interfaces/plugin.interface';
import type { PluginContext } from '../interfaces/plugin-context.interface';
import type { PluginConfigData } from '../../../repositories/plugin-config.repository';
import type { WorkerState } from '../types/worker-state.type';
import { BatchBuffer } from '../../streaming/batch-buffer.service';

export class IngestionWorker {
    private backfillAbort = new AbortController();
    private streamAbort = new AbortController();
    private state: WorkerState = {
        backfill: 'IDLE',
        stream: 'IDLE',
        startedAt: new Date(),
    };

    constructor(
        private pluginName: string,
        private chatId: string,
        private config: PluginConfigData,
        private pluginManager: { get(name: string): IPlugin | undefined; getContext(): PluginContext },
    ) {}

    async run(): Promise<void> {
        const plugin = this.pluginManager.get(this.pluginName);
        if (!plugin) throw new Error(`Plugin "${this.pluginName}" not found`);
        const context = this.pluginManager.getContext();

        const backfillPromise = this.runBackfill(plugin, context);
        const streamPromise = this.runStream(plugin, context);

        await backfillPromise;
        this.state.backfill = 'COMPLETED';

        await streamPromise;
    }

    private async runBackfill(
        plugin: IPlugin,
        context: PluginContext,
    ): Promise<void> {
        this.state.backfill = 'RUNNING';
        const cursor = await context.getCursor(
            this.pluginName,
            this.config.userId,
            this.chatId,
        );
        const limit =
            cursor ? 10_000 : ((this.config.config as any)?.historyLimit ?? -1);

        try {
            for await (const result of plugin.backfill(
                { limit, userId: this.config.userId, chatId: this.chatId },
                context,
                this.backfillAbort.signal,
            )) {
                this.state.backfillProgress = result;
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
        const batchSize = 10;
        const maxWindowMs = 30_000;
        const buffer = new BatchBuffer(
            batchSize,
            maxWindowMs,
            async (batch) => {
                await context.storeEnvelopes(batch, this.config.userId);
                const lastId = batch[batch.length - 1]?.envelope.sourceId;
                if (lastId) {
                    await context.saveCursor(
                        this.pluginName,
                        this.config.userId,
                        this.chatId,
                        Number(lastId),
                    );
                }
            },
        );

        try {
            for await (const batch of plugin.startStream(
                { userId: this.config.userId, chatId: this.chatId },
                context,
                this.streamAbort.signal,
            )) {
                for (const msg of batch.envelopes) buffer.add(msg);
            }
        } catch (err) {
            if (!this.streamAbort.signal.aborted) throw err;
        } finally {
            await buffer.flush();
            this.state.stream = 'STOPPED';
        }
    }

    abort(): void {
        this.backfillAbort.abort();
        this.streamAbort.abort();
    }

    getState(): WorkerState {
        return { ...this.state };
    }
}
