import { Injectable, Logger } from '@nestjs/common';
import { IPlugin, PluginLoginResult } from '../interfaces/plugin.interface';
import { EnvelopeWithPayload } from '../../../types/envelope.types';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramTopicStore } from './telegram-topic.store';
import { normalizeTelegramMessage } from './normalizer';
import { resolveEntities, resolveTopicId } from './telegram-utils';
import type { TelegramMessageRaw } from './telegram.types';

interface TelegramConfig {
    userId: string;
    apiId: number;
    apiHash: string;
    chats: string[];
}

@Injectable()
export class TelegramPluginService implements IPlugin {
    readonly name = 'telegram';
    private readonly logger = new Logger(TelegramPluginService.name);

    private config: TelegramConfig | null = null;

    constructor(
        private readonly factory: TelegramClientFactory,
        private readonly auth: TelegramAuthService,
        private readonly topicStore: TelegramTopicStore,
    ) {}

    async initialize(config: Record<string, unknown>): Promise<void> {
        this.config = config as unknown as TelegramConfig;
        this.logger.log(
            `Telegram plugin initialized for user ${this.config?.userId}`,
        );
    }

    async login(
        credentials: Record<string, unknown>,
    ): Promise<PluginLoginResult> {
        if (!this.config) throw new Error('Plugin not initialized');
        const phone = (credentials as any).phoneNumber ?? '';

        return this.auth.authenticate(
            phone,
            this.config.userId,
            this.config.apiId,
            this.config.apiHash,
        );
    }

    async handleAction(
        action: string,
        params: Record<string, unknown>,
    ): Promise<unknown> {
        switch (action) {
            case 'submit-code':
                return this.submitCode(
                    params['pendingId'] as string,
                    params['code'] as string,
                );
            case 'submit-password':
                return this.submitPassword(
                    params['pendingId'] as string,
                    params['password'] as string,
                );
            default:
                throw new Error(
                    `Unknown action "${action}" for plugin "${this.name}"`,
                );
        }
    }

    private async submitCode(
        pendingId: string,
        code: string,
    ): Promise<PluginLoginResult> {
        if (!this.config) throw new Error('Plugin not initialized');

        return this.auth.verifyCode(
            pendingId,
            code,
            this.config.userId,
            this.config.apiId,
            this.config.apiHash,
        );
    }

    private async submitPassword(
        pendingId: string,
        password: string,
    ): Promise<PluginLoginResult> {
        if (!this.config) throw new Error('Plugin not initialized');

        await this.auth.verifyPassword(
            pendingId,
            password,
            this.config.userId,
            this.config.apiId,
            this.config.apiHash,
        );
        return { status: 'ok' };
    }

    async logout(): Promise<void> {
        if (!this.config) throw new Error('Plugin not initialized');
        await this.auth.logout(this.config.userId);
    }

    async *backfill(limit: number): AsyncIterable<EnvelopeWithPayload[]> {
        if (!this.config) throw new Error('Plugin not initialized');

        const { client } = await this.auth.loadSession(
            this.config.userId,
            this.config.apiId,
            this.config.apiHash,
        );

        try {
            for (const chatId of this.config.chats) {
                this.logger.log(`Backfilling chat ${chatId} limit ${limit}`);

                const messageToTopicMap =
                    await this.topicStore.prewarmChat(chatId);
                const pendingTopicEntries: {
                    chatId: string;
                    messageId: number;
                    topicId: number;
                }[] = [];

                const chat = await client.getEntity(chatId);
                let offsetId = 1;
                let totalFetched = 0;
                const maxLimit = limit < 0 ? Infinity : limit;

                while (totalFetched < maxLimit) {
                    const batchSize = Math.min(100, maxLimit - totalFetched);
                    const messages: any[] = await client.getMessages(chat, {
                        limit: batchSize,
                        offsetId,
                        reverse: true,
                    });

                    if (messages.length === 0) break;

                    const chunk: TelegramMessageRaw[] = [];
                    for (const msg of messages) {
                        const raw = JSON.parse(JSON.stringify(msg));
                        const ts =
                            msg.date instanceof Date
                                ? msg.date
                                : new Date((msg.date as number) * 1000);

                        // Resolve channel_id / group_id from peer_id
                        let channelId: string | null = null;
                        let groupId: string | null = null;
                        if (raw.peerId?.className === 'PeerChannel') {
                            channelId = raw.peerId.channelId.toString();
                        }
                        if (raw.peerId?.className === 'PeerChat') {
                            groupId = raw.peerId.chatId.toString();
                        } else {
                            groupId = chatId;
                        }

                        // Resolve author_id from from_id
                        let authorId: string | null = null;
                        if (raw.fromId?.userId) {
                            authorId = raw.fromId.userId.toString();
                        } else if (raw.fromId?.channelId) {
                            authorId = raw.fromId.channelId.toString();
                        } else if (raw.fromId?.chatId) {
                            authorId = raw.fromId.chatId.toString();
                        }

                        // Resolve entities
                        const msgText = (msg.text ??
                            msg.message ??
                            '') as string;
                        const resolvedEntities = resolveEntities(
                            msgText,
                            raw.entities ?? [],
                        );

                        // Resolve topic_id
                        const topicId = resolveTopicId(
                            msg,
                            raw,
                            messageToTopicMap,
                        );
                        messageToTopicMap.set(msg.id as number, topicId);
                        pendingTopicEntries.push({
                            chatId,
                            messageId: msg.id as number,
                            topicId,
                        });

                        chunk.push({
                            id: msg.id as number,
                            channel_id: channelId,
                            group_id: groupId,
                            text: msgText,
                            date: ts,
                            replyTo:
                                (msg.replyTo?.replyToMsgId as
                                    number | undefined) ?? null,
                            topic_id: topicId,
                            author_id: authorId,
                            hasAttachment: !!msg.media,
                            reactions: raw.reactions ?? {},
                            pinned: !!msg.pinned,
                            editedDate: msg.editDate ?? null,
                            resolved_entities:
                                resolvedEntities.length > 0
                                    ? resolvedEntities
                                    : null,
                            raw,
                        });
                    }

                    if (chunk.length > 0) {
                        yield chunk.map(normalizeTelegramMessage);
                    }

                    totalFetched += messages.length;
                    offsetId = messages[messages.length - 1].id as number;
                    if (messages.length < 100) break;
                }

                if (pendingTopicEntries.length > 0) {
                    await this.topicStore.setBatch(pendingTopicEntries);
                }
            }
        } finally {
            await this.factory.destroy(client);
        }
    }

    async *startStream(): AsyncIterable<EnvelopeWithPayload[]> {
        throw new Error('Streaming not implemented yet');
    }

    stopStream(): void {
        // Not implemented yet
    }
}
