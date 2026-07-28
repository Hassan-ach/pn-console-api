import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PluginStatus } from 'generated/app-db-client';
import { ActiveChatListenerRepository } from '../../../repositories/active-chat-listener.repository';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { PluginManagerService } from './plugin-manager.service';
import { IngestionWorker } from './ingestion-worker.service';
import type { PluginConfigData } from '../../../repositories/plugin-config.repository';
import type { WorkerState } from '../types/worker-state.type';

function isSessionExpired(err: Error): boolean {
    const msg = err.message;
    return (
        msg.includes('AUTH_KEY_UNREGISTERED') ||
        msg.includes('SESSION_REVOKED') ||
        msg.includes('USER_DEACTIVATED') ||
        msg.includes('SESSION_EXPIRED')
    );
}

@Injectable()
export class WorkerManager implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(WorkerManager.name);
    private workers = new Map<string, IngestionWorker>();

    constructor(
        private readonly activeChatRepo: ActiveChatListenerRepository,
        private readonly configRepo: PluginConfigRepository,
        private readonly pluginManager: PluginManagerService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        const listeners = await this.activeChatRepo.findAllActive();
        for (const listener of listeners) {
            const config = await this.configRepo.findUnique(
                listener.ownerUserId,
                listener.pluginName,
            );
            if (config) {
                this.startWorker(
                    listener.pluginName,
                    listener.chatId,
                    config,
                );
            } else {
                await this.activeChatRepo.delete(listener.id);
            }
        }
    }

    start(config: PluginConfigData): void {
        const chats: { id: string }[] = (config.config as any)?.chats ?? [];
        for (const chat of chats) {
            this.startWorker(config.pluginName, chat.id, config);
        }
    }

    startWorker(
        pluginName: string,
        chatId: string,
        config: PluginConfigData,
    ): void {
        const key = `${pluginName}:${chatId}`;
        if (this.workers.has(key)) return;

        const worker = new IngestionWorker(
            pluginName,
            chatId,
            config,
            this.pluginManager,
        );
        this.workers.set(key, worker);
        worker.run().catch((err) =>
            this.handleError(key, pluginName, chatId, err),
        );
    }

    stop(pluginName: string, chatId: string): void {
        const key = `${pluginName}:${chatId}`;
        const worker = this.workers.get(key);
        if (worker) {
            worker.abort();
            this.workers.delete(key);
        }
    }

    getState(pluginName: string, chatId: string): WorkerState | null {
        const key = `${pluginName}:${chatId}`;
        return this.workers.get(key)?.getState() ?? null;
    }

    async onApplicationShutdown(): Promise<void> {
        for (const [, worker] of this.workers) {
            worker.abort();
        }
        await new Promise((r) => setTimeout(r, 5000));
    }

    private async handleError(
        key: string,
        pluginName: string,
        chatId: string,
        err: Error,
    ): Promise<void> {
        this.workers.delete(key);

        if (isSessionExpired(err)) {
            await this.recoverFromSessionExpiry(pluginName, chatId);
            return;
        }

        this.logger.error(`Worker ${key} failed: ${err.message}`);
    }

    private async recoverFromSessionExpiry(
        pluginName: string,
        chatId: string,
    ): Promise<void> {
        const listener =
            await this.activeChatRepo.findByPluginAndChat(pluginName, chatId);
        if (!listener || listener.subscriberCount <= 1) {
            await this.activeChatRepo.deleteByPluginAndChat(
                pluginName,
                chatId,
            );
            if (listener) {
                    await this.configRepo.update(
                        listener.ownerUserId,
                        pluginName,
                        {
                            status: PluginStatus.ERROR,
                            errorMessage:
                                'Session expired — reconnect and activate again',
                        },
                    );
            }
            return;
        }

        const subscribers = await this.activeChatRepo.getSubscriberUserIds(
            pluginName,
            chatId,
            listener.ownerUserId,
        );
        for (const userId of subscribers) {
            const config = await this.configRepo.findUnique(
                userId,
                pluginName,
            );
            if (config?.sessionString) {
                await this.activeChatRepo.transferOwnership(
                    pluginName,
                    chatId,
                    userId,
                );
                this.startWorker(pluginName, chatId, config);
                this.logger.log(
                    `Ownership of ${pluginName}:${chatId} transferred to ${userId}`,
                );
                return;
            }
        }

        await this.activeChatRepo.deleteByPluginAndChat(pluginName, chatId);
    }
}
