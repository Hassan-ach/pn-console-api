import { Injectable, Logger } from '@nestjs/common';
import { PluginStatus } from 'generated/app-db-client';
import { ActiveChatListenerRepository } from 'src/repositories/active-chat-listener.repository';
import {
    PluginConfigData,
    PluginConfigRepository,
} from 'src/repositories/plugin-config.repository';

export { isSessionExpired } from '../plugins/utils/provider-utils';

@Injectable()
export class WorkerRecoveryService {
    private readonly logger = new Logger(WorkerRecoveryService.name);

    constructor(
        private readonly activeChatRepo: ActiveChatListenerRepository,
        private readonly configRepo: PluginConfigRepository,
    ) {}

    async recoverFromSessionExpiry(
        pluginName: string,
        chatId: string,
        onNewOwnerConfig: (config: PluginConfigData) => void,
    ): Promise<void> {
        const listener = await this.activeChatRepo.findByPluginAndChat(
            pluginName,
            chatId,
        );
        if (!listener || listener.subscriberCount <= 1) {
            await this.activeChatRepo.deleteByPluginAndChat(pluginName, chatId);
            if (listener) {
                await this.configRepo.update(listener.ownerUserId, pluginName, {
                    status: PluginStatus.ERROR,
                    errorMessage:
                        'Session expired — reconnect and activate again',
                });
            }
            return;
        }

        const subscribers = await this.activeChatRepo.getSubscriberUserIds(
            pluginName,
            chatId,
            listener.ownerUserId,
        );
        for (const userId of subscribers) {
            const config = await this.configRepo.findUnique(userId, pluginName);
            if (config?.sessionString) {
                await this.activeChatRepo.transferOwnership(
                    pluginName,
                    chatId,
                    userId,
                );
                onNewOwnerConfig(config);
                this.logger.log(
                    `Ownership of ${pluginName}:${chatId} transferred to ${userId}`,
                );
                return;
            }
        }

        await this.activeChatRepo.deleteByPluginAndChat(pluginName, chatId);
    }
}
