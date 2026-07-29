import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnApplicationShutdown,
} from '@nestjs/common';
import { PluginStatus } from 'generated/app-db-client';
import { ActiveChatListenerRepository } from 'src/repositories/active-chat-listener.repository';
import { PluginConfigRepository } from 'src/repositories/plugin-config.repository';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import { IngestionWorker } from './ingestion-worker.service';
import { IntelligenceEngineService } from 'src/intelligence/intelligence-engine.service';
import type { PluginConfigData } from 'src/repositories/plugin-config.repository';
import type { WorkerState } from '../plugins/types/worker-state.type';
import {
    LOCK_MANAGER_TOKEN,
    type ILockManager,
} from 'src/common/providers/lock-manager/lock-manager.interface';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import {
    PluginActivatedEvent,
    PluginConfigUpdatedEvent,
    PluginDeactivatedEvent,
} from '../events/ingestion.events';
import { extractProviderChats } from '../plugins/interfaces/provider-config.interface';
import {
    WorkerRecoveryService,
    isSessionExpired,
} from './worker-recovery.service';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkerManager
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private readonly logger = new Logger(WorkerManager.name);
    private readonly instanceId: string;
    private workers = new Map<string, IngestionWorker>();

    constructor(
        private readonly activeChatRepo: ActiveChatListenerRepository,
        private readonly configRepo: PluginConfigRepository,
        private readonly pluginManager: PluginManagerService,
        private readonly intelligenceEngine: IntelligenceEngineService,
        private readonly recoveryService: WorkerRecoveryService,
        private readonly configService: ConfigService,
        @Inject(LOCK_MANAGER_TOKEN) private readonly lockManager: ILockManager,
        @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    ) {
        this.instanceId =
            process.env.HOSTNAME ?? `instance-${crypto.randomUUID()}`;
    }

    async onApplicationBootstrap(): Promise<void> {
        const listeners = await this.activeChatRepo.findAllActive();

        for (const listener of listeners) {
            const resource = `${listener.pluginName}:${listener.chatId}`;
            const acquired = await this.lockManager.acquire(
                resource,
                this.instanceId,
            );
            if (acquired) {
                const config = await this.configRepo.findUnique(
                    listener.ownerUserId,
                    listener.pluginName,
                );
                if (config) {
                    await this.activeChatRepo.claim(
                        listener.id,
                        this.instanceId,
                    );
                    this.startWorker(
                        listener.pluginName,
                        listener.chatId,
                        config,
                    );
                } else {
                    await this.lockManager.release(resource, this.instanceId);
                    await this.activeChatRepo.delete(listener.id);
                }
            }
        }

        this.eventBus.subscribe<PluginActivatedEvent>(
            'plugin.activated',
            (event) => {
                this.start(event.config);
            },
        );

        this.eventBus.subscribe<PluginDeactivatedEvent>(
            'plugin.deactivated',
            (event) => {
                const chats = extractProviderChats(event.config.config);
                for (const chat of chats) {
                    this.stop(event.pluginName, chat.id);
                }
            },
        );

        this.eventBus.subscribe<PluginConfigUpdatedEvent>(
            'plugin.config.updated',
            (event) => {
                this.syncWorkersForConfig(event.config);
            },
        );
    }

    start(config: PluginConfigData): void {
        const chats = extractProviderChats(config.config);
        for (const chat of chats) {
            this.startWorker(config.pluginName, chat.id, config);
        }
    }

    syncWorkersForConfig(config: PluginConfigData): void {
        const chats = extractProviderChats(config.config);
        const activeChatIds = new Set(chats.map((c) => c.id));
        const prefix = `${config.pluginName}:`;

        for (const [key] of this.workers) {
            if (key.startsWith(prefix)) {
                const chatId = key.substring(prefix.length);
                if (!activeChatIds.has(chatId)) {
                    this.logger.log(`Stopping worker for removed chat ${key}`);
                    this.stop(config.pluginName, chatId);
                }
            }
        }

        for (const chat of chats) {
            const key = `${config.pluginName}:${chat.id}`;
            if (!this.workers.has(key)) {
                this.logger.log(`Starting worker for newly added chat ${key}`);
                this.startWorker(config.pluginName, chat.id, config);
            }
        }
    }

    startWorker(
        pluginName: string,
        chatId: string,
        config: PluginConfigData,
    ): void {
        const key = `${pluginName}:${chatId}`;
        if (this.workers.has(key)) {
            this.logger.warn(`Worker ${key} already exists, skipping`);
            return;
        }

        this.logger.log(`Starting worker for ${key}`);
        const dbBatchSize = this.configService.get<number>('ingestion.dbBatchSize', 10);
        const dbBatchWindowMs = this.configService.get<number>('ingestion.dbBatchWindowMs', 5000);

        const worker = new IngestionWorker(
            pluginName,
            chatId,
            config,
            this.pluginManager,
            this.intelligenceEngine,
            this.eventBus,
            { batchSize: dbBatchSize, batchWindowMs: dbBatchWindowMs },
        );
        this.workers.set(key, worker);
        worker
            .run()
            .catch((err) =>
                this.handleError(key, pluginName, chatId, config.userId, err),
            );
    }

    stop(pluginName: string, chatId: string): void {
        const key = `${pluginName}:${chatId}`;
        const worker = this.workers.get(key);
        if (worker) {
            worker.abort();
            this.workers.delete(key);
            void this.lockManager.release(key, this.instanceId);
        }
    }

    getState(pluginName: string, chatId: string): WorkerState | null {
        const key = `${pluginName}:${chatId}`;
        return this.workers.get(key)?.getState() ?? null;
    }

    async onApplicationShutdown(): Promise<void> {
        for (const [key, worker] of this.workers) {
            worker.abort();
            await this.lockManager.release(key, this.instanceId);
        }
    }

    private async handleError(
        key: string,
        pluginName: string,
        chatId: string,
        userId: string,
        err: Error,
    ): Promise<void> {
        this.workers.delete(key);
        await this.lockManager.release(key, this.instanceId);

        if (isSessionExpired(err)) {
            await this.recoveryService.recoverFromSessionExpiry(
                pluginName,
                chatId,
                (config) => this.startWorker(pluginName, chatId, config),
            );
            return;
        }

        this.logger.error(`Worker ${key} failed: ${err.message}`);
        try {
            await this.configRepo.update(userId, pluginName, {
                status: PluginStatus.ERROR,
                errorMessage: err.message,
            });
        } catch (updateErr) {
            this.logger.error(
                `Failed to set ERROR status for ${key}: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`,
            );
        }
    }
}
