import {
    BadRequestException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { PluginStatus } from 'generated/app-db-client';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { ActiveChatListenerRepository } from '../../../repositories/active-chat-listener.repository';
import { PlatformUserMappingRepository } from '../../../repositories/platform-user-mapping.repository';
import { WorkerManager } from '../../workers/worker-manager.service';
import { PluginManagerService } from './plugin-manager.service';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';
import type { WorkerState } from '../types/worker-state.type';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import {
    PluginActivatedEvent,
    PluginDeactivatedEvent,
} from '../../events/ingestion.events';
import {
    ProviderChatEntry,
    extractProviderChats,
} from '../interfaces/provider-config.interface';

@Injectable()
export class PluginActivationService {
    private readonly logger = new Logger(PluginActivationService.name);

    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly activeChatRepo: ActiveChatListenerRepository,
        @Inject(forwardRef(() => WorkerManager))
        private readonly workerManager: WorkerManager,
        private readonly pluginManager: PluginManagerService,
        private readonly rawDb: RawDbService,
        private readonly platformUserMappingRepo: PlatformUserMappingRepository,
        @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    ) {}

    async activate(
        userId: string,
        pluginName: string,
    ): Promise<{
        status: string;
        activatedChats: string[];
        alreadyActiveChats: string[];
    }> {
        this.logger.log(`Activating ${pluginName} for user ${userId}`);
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config) throw new BadRequestException('Plugin not configured');
        if (
            config.status !== PluginStatus.CONFIGURED &&
            config.status !== PluginStatus.ERROR
        )
            throw new BadRequestException(
                `Cannot activate from status ${config.status}`,
            );

        if (config.status === PluginStatus.ERROR) {
            await this.configRepo.update(userId, pluginName, {
                status: PluginStatus.CONFIGURED,
                errorMessage: null,
            });
        }

        const plugin = this.pluginManager.get(pluginName);
        if (!plugin)
            throw new BadRequestException(`Plugin "${pluginName}" not found`);

        const requirements =
            plugin.getActivationRequirements?.(config.config) ?? [];
        for (const req of requirements) {
            if (!req.validate(config.config)) {
                throw new BadRequestException(req.message);
            }
        }

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.ACTIVATING,
        });

        const orgId = this.pluginManager.getContext().resolveOrgId(userId);
        const chats = extractProviderChats(config.config);
        const { activatedChats, alreadyActiveChats } =
            await this.syncChatSubscriptions(userId, orgId, pluginName, chats);

        this.eventBus.publish(
            'plugin.activated',
            new PluginActivatedEvent(userId, pluginName, config),
        );

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.ACTIVE,
            activatedAt: new Date(),
        });

        this.logger.log(`Activation complete for ${pluginName}`);
        return { status: 'ACTIVE', activatedChats, alreadyActiveChats };
    }

    async deactivate(userId: string, pluginName: string): Promise<void> {
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config || config.status !== PluginStatus.ACTIVE) return;

        await this.configRepo.update(userId, pluginName, {
            status: PluginStatus.DEACTIVATING,
        });

        const chats = extractProviderChats(config.config);
        for (const chat of chats) {
            await this.activeChatRepo.unsubscribe(pluginName, chat.id, userId);
        }

        this.eventBus.publish(
            'plugin.deactivated',
            new PluginDeactivatedEvent(userId, pluginName, config),
        );

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
        platformUsername?: string;
        platformUserId?: string;
        chats: {
            chatId: string;
            worker: WorkerState | null;
            cursor: number | null;
        }[];
    }> {
        const config = await this.configRepo.findUnique(userId, pluginName);
        if (!config) return { status: 'NOT_CONNECTED', chats: [] };

        const mappings =
            await this.platformUserMappingRepo.findByAppUser(userId);
        const mapping = mappings.find((m) => m.pluginName === pluginName);

        const pluginChats = extractProviderChats(config.config);
        const chatStates = await Promise.all(
            pluginChats.map(async (chat) => {
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
                    name: chat.name,
                    worker: workerState,
                    cursor: cursor ? Number(cursor.value) : null,
                };
            }),
        );

        return {
            status: config.status,
            activatedAt: config.activatedAt ?? undefined,
            errorMessage: config.errorMessage ?? undefined,
            platformUsername: mapping?.platformUsername ?? undefined,
            platformUserId: mapping?.platformUserId ?? undefined,
            chats: chatStates,
        };
    }

    private async syncChatSubscriptions(
        userId: string,
        orgId: string,
        pluginName: string,
        chats: ProviderChatEntry[],
    ) {
        const activatedChats: string[] = [];
        const alreadyActiveChats: string[] = [];

        for (const chat of chats) {
            const listener = await this.activeChatRepo.findByPluginAndChat(
                pluginName,
                chat.id,
            );
            await this.activeChatRepo.subscribe(
                pluginName,
                chat.id,
                orgId,
                userId,
            );
            if (listener) {
                alreadyActiveChats.push(chat.id);
            } else {
                activatedChats.push(chat.id);
            }
        }
        return { activatedChats, alreadyActiveChats };
    }
}
