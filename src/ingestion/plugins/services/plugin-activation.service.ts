import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import { PluginStatus } from 'generated/app-db-client';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { ActiveChatListenerRepository } from '../../../repositories/active-chat-listener.repository';
import { WorkerManager } from './worker-manager.service';
import { PluginManagerService } from './plugin-manager.service';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';
import type { WorkerState } from '../types/worker-state.type';

@Injectable()
export class PluginActivationService {
    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly activeChatRepo: ActiveChatListenerRepository,
        private readonly workerManager: WorkerManager,
        private readonly pluginManager: PluginManagerService,
        private readonly rawDb: RawDbService,
    ) {}

    async activate(
        userId: string,
        pluginName: string,
    ): Promise<{
        status: string;
        activatedChats: string[];
        alreadyActiveChats: string[];
    }> {
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config)
            throw new BadRequestException('Plugin not configured');
        if (config.status !== PluginStatus.CONFIGURED)
            throw new BadRequestException(
                `Cannot activate from status ${config.status}`,
            );

        const plugin = this.pluginManager.get(pluginName);
        if (!plugin)
            throw new BadRequestException(`Plugin "${pluginName}" not found`);

        const requirements =
            plugin.getActivationRequirements?.(config.config as Record<string, unknown>) ?? [];
        for (const req of requirements) {
            if (!req.validate(config.config as Record<string, unknown>)) {
                throw new BadRequestException(req.message);
            }
        }

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.ACTIVATING,
        });

        const orgId = this.pluginManager
            .getContext()
            .resolveOrgId(userId);
        const chats: { id: string }[] =
            (config.config as any)?.chats ?? [];
        const activatedChats: string[] = [];
        const alreadyActiveChats: string[] = [];

        for (const chat of chats) {
            const listener = await this.activeChatRepo.findByPluginAndChat(
                pluginName,
                chat.id,
            );
            if (listener) {
                await this.activeChatRepo.subscribe(
                    pluginName,
                    chat.id,
                    orgId,
                    userId,
                );
                alreadyActiveChats.push(chat.id);
            } else {
                await this.activeChatRepo.subscribe(
                    pluginName,
                    chat.id,
                    orgId,
                    userId,
                );
                activatedChats.push(chat.id);
            }
        }

        this.workerManager.start(config);

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.ACTIVE,
            activatedAt: new Date(),
        });

        return { status: 'ACTIVE', activatedChats, alreadyActiveChats };
    }

    async deactivate(userId: string, pluginName: string): Promise<void> {
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config || config.status !== PluginStatus.ACTIVE) return;

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.DEACTIVATING,
        });

        const orgId = this.pluginManager
            .getContext()
            .resolveOrgId(userId);
        const chats: { id: string }[] =
            (config.config as any)?.chats ?? [];
        for (const chat of chats) {
            await this.activeChatRepo.unsubscribe(
                pluginName,
                chat.id,
                userId,
            );
        }

        for (const chat of chats) {
            const listener = await this.activeChatRepo.findByPluginAndChat(
                pluginName,
                chat.id,
            );
            if (!listener || listener.subscriberCount <= 0) {
                this.workerManager.stop(pluginName, chat.id);
                if (listener)
                    await this.activeChatRepo.delete(listener.id);
            }
        }

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.CONFIGURED,
            activatedAt: null,
        });
    }

    async getStatus(
        userId: string,
        pluginName: string,
    ): Promise<{
        status: string;
        activatedAt?: Date;
        errorMessage?: string;
        chats: {
            chatId: string;
            worker: WorkerState | null;
            cursor: number | null;
        }[];
    }> {
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config) return { status: 'NOT_CONNECTED', chats: [] };

        const chats: { id: string }[] =
            (config.config as any)?.chats ?? [];
        const chatStates = await Promise.all(
            chats.map(async (chat) => {
                const workerState = this.workerManager.getState(
                    pluginName,
                    chat.id,
                );
                const cursor = await this.rawDb.pluginCursor.findUnique({
                    where: {
                        pluginName_userId_key: {
                            pluginName,
                            userId,
                            key: chat.id,
                        },
                    },
                });
                return {
                    chatId: chat.id,
                    worker: workerState,
                    cursor: cursor ? Number(cursor.value) : null,
                };
            }),
        );

        return {
            status: config.status as string,
            activatedAt: config.activatedAt ?? undefined,
            errorMessage: config.errorMessage ?? undefined,
            chats: chatStates,
        };
    }
}
