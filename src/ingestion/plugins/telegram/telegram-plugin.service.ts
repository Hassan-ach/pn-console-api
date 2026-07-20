import { Injectable, Logger } from '@nestjs/common';
import { IPlugin } from '../interfaces/plugin.interface';
import type { StoreResult } from '../interfaces/plugin-context.interface';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramTopicStore } from './telegram-topic.store';
import { normalizeTelegramMessage } from './normalizer';
import { resolveEntities, resolveTopicId } from './telegram-utils';
import type { PluginContext } from '../interfaces/plugin-context.interface';
import type { TelegramMessageRaw } from './telegram.types';
import type { BackFillOpts } from '../interfaces/plugin.interface';

interface TelegramConfig {
    apiId: number;
    apiHash: string;
    sessionString: string;
    chats: string[];
    phone?: string;
}

@Injectable()
export class TelegramPluginService implements IPlugin {
    readonly name = 'telegram';
    private readonly logger = new Logger(TelegramPluginService.name);

    constructor(private readonly factory: TelegramClientFactory) {}

    async isConnected(
        context: PluginContext,
        userId: string,
        config?: Record<string, unknown>,
    ): Promise<boolean> {
        const cfg = config ?? (await context.getConfig(userId, this.name));
        if (!cfg) return false;
        const c = cfg as unknown as TelegramConfig;
        if (!c.sessionString) return false;

        const client = this.factory.create(c.apiId, c.apiHash, c.sessionString);
        try {
            await client.connect();
            return client.connected ?? false;
        } catch {
            return false;
        } finally {
            await this.factory.destroy(client);
        }
    }

    async *backfill(
        { limit, userId }: BackFillOpts,
        context: PluginContext,
    ): AsyncIterable<StoreResult> {
        const config = await context.getConfig(userId, this.name);
        if (!config) {
            throw new Error('Telegram not configured');
        }

        const cfg = config as unknown as TelegramConfig;
        if (!cfg.sessionString) {
            throw new Error('No session. Connect Telegram first.');
        }

        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );

        try {
            await client.connect();

            for (const chatId of cfg.chats ?? []) {
                this.logger.log(`Backfilling chat ${chatId} limit ${limit}`);

                const topicStore = new TelegramTopicStore(userId, chatId);
                const messageToTopicMap = await topicStore.prewarmChat();
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

                        let authorId: string | null = null;
                        if (raw.fromId?.userId) {
                            authorId = raw.fromId.userId.toString();
                        } else if (raw.fromId?.channelId) {
                            authorId = raw.fromId.channelId.toString();
                        } else if (raw.fromId?.chatId) {
                            authorId = raw.fromId.chatId.toString();
                        }

                        const msgText = (msg.text ??
                            msg.message ??
                            '') as string;
                        const resolvedEntities = resolveEntities(
                            msgText,
                            raw.entities ?? [],
                        );

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
                                    | number
                                    | undefined) ?? null,
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
                        const envelopes = chunk.map(normalizeTelegramMessage);
                        const result = await context.storeEnvelopes(
                            envelopes,
                            userId,
                        );
                        yield result;
                    }

                    totalFetched += messages.length;
                    offsetId = messages[messages.length - 1].id as number;
                    if (messages.length < 100) break;
                }

                if (pendingTopicEntries.length > 0) {
                    await topicStore.setBatch(pendingTopicEntries);
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
