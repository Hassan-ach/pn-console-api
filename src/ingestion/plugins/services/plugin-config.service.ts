import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { ActiveChatListenerRepository } from '../../../repositories/active-chat-listener.repository';
import { PluginStatus } from 'generated/app-db-client';
import { PlatformUserInfo } from '../interfaces/plugin.interface';
import type { PluginContext } from '../interfaces/plugin-context.interface';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import { Events } from 'src/common/providers/event-bus/events.registry';
import {
    PluginConfigUpdatedEvent,
    PluginDeactivatedEvent,
} from '../../events/ingestion.events';
import { extractProviderChats } from '../interfaces/provider-config.interface';

@Injectable()
export class PluginConfigService {
    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly activeChatRepo: ActiveChatListenerRepository,
        @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    ) {}

    async getConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        const row = await this.configRepo.findUnique(userId, name);
        return row?.config ?? null;
    }

    async getSanitizedConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        const config = await this.getConfig(name, userId);
        if (!config) return null;
        return { ...config };
    }

    async createConfig(
        userId: string,
        pluginName: string,
        data: {
            organizationId: string;
            config: Record<string, unknown>;
            metadata?: Record<string, unknown>;
        },
    ): Promise<void> {
        await this.configRepo.upsert(userId, pluginName, data);
    }

    async updateConfig(
        name: string,
        config: Record<string, unknown>,
        userId: string,
    ): Promise<void> {
        await this.configRepo.update(userId, name, { config: config });
        const updated = await this.configRepo.findUnique(userId, name);
        if (!updated) return;

        if (updated.status === PluginStatus.CONNECTED) {
            const cfg = updated.config;
            const chats = cfg.chats;
            if (Array.isArray(chats) && chats.length > 0) {
                await this.configRepo.update(userId, name, {
                    status: PluginStatus.CONFIGURED,
                });
            }
        } else if (updated.status === PluginStatus.ACTIVE) {
            const chats = extractProviderChats(updated.config);
            const orgId = updated.organizationId ?? 'org-1';
            for (const chat of chats) {
                await this.activeChatRepo.subscribe(
                    name,
                    chat.id,
                    orgId,
                    userId,
                );
            }
            this.eventBus.publish(
                Events.PLUGIN_CONFIG_UPDATED,
                new PluginConfigUpdatedEvent(userId, name, updated),
            );
        }
    }

    async deleteConfig(name: string, userId: string): Promise<void> {
        await this.configRepo.remove(userId, name);
    }

    async disconnect(name: string, userId: string): Promise<void> {
        const config = await this.configRepo.findUnique(userId, name);
        await this.configRepo.clearSessionString(userId, name);
        const updated = await this.configRepo.update(userId, name, {
            status: PluginStatus.CONNECTED,
        });

        if (config) {
            const chats = extractProviderChats(config.config);
            for (const chat of chats) {
                await this.activeChatRepo.unsubscribe(name, chat.id, userId);
            }
            this.eventBus.publish(
                Events.PLUGIN_DEACTIVATED,
                new PluginDeactivatedEvent(userId, name, updated),
            );
        }
    }

    async login(
        name: string,
        userId: string,
        config: Record<string, unknown>,
        validateAuth: (sessionString: string) => Promise<PlatformUserInfo>,
        context: PluginContext,
    ): Promise<PlatformUserInfo> {
        const sessionString = config.sessionString as string | undefined;
        if (!sessionString) {
            throw new NotFoundException(`sessionString is required for login`);
        }
        const configJson = { ...config };
        delete configJson.sessionString;

        await this.configRepo.upsert(userId, name, {
            organizationId: context.resolveOrgId(userId),
            config: configJson,
        });

        const userInfo = await validateAuth(sessionString);

        await this.configRepo.updateSessionString(userId, name, sessionString);
        await this.configRepo.update(userId, name, {
            status: PluginStatus.CONNECTED,
        });

        return userInfo;
    }
}
