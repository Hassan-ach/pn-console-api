import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPlugin, PlatformUserInfo } from '../../interfaces/plugin.interface';
import type { StoreResult } from '../../interfaces/plugin-context.interface';

import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramTopicStore } from './telegram-topic.store';
import { normalizeTelegramMessage } from '../utils/normalizer';
import { normalizeRawMessage, resolveTopicId } from '../utils/telegram-utils';
import type { PluginContext } from '../../interfaces/plugin-context.interface';
import type { TelegramMessageRaw } from '../types/telegram.types';
import type {
    BackFillOpts,
    StreamBatch,
    StreamOpts,
} from '../../interfaces/plugin.interface';

interface TelegramChat {
    name: string;
    id: string;
}

interface TelegramConfig {
    apiId: number;
    apiHash: string;
    sessionString: string;
    chats: TelegramChat[];
    phone?: string;
}

@Injectable()
export class TelegramPluginService implements IPlugin {
    readonly name = 'telegram';
    constructor(
        private readonly factory: TelegramClientFactory,
        private readonly config: ConfigService,
    ) {}

    async validateAuth(
        sessionString: string,
        context: PluginContext,
        userId: string,
    ): Promise<PlatformUserInfo> {
        const config = await context.getConfig(userId, this.name);
        if (!config) {
            throw new BadRequestException(
                'Plugin not configured — save API credentials first',
            );
        }

        const cfg = config as unknown as TelegramConfig;
        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            sessionString,
        );

        try {
            await client.connect();
            const me = await client.getMe();
            const platformUserId = String(me.id);
            // const fullName = [me.firstName, me.lastName]
            //     .filter(Boolean)
            //     .join(' ');
            // const platformUsername =
            //     fullName || (me.username as string) || platformUserId;

            const platformUsername =
                (me.username as string) ||
                (me.firstName as string) ||
                platformUserId;

            await context.storeUserMapping(userId, this.name, {
                platformUserId,
                platformUsername,
            });

            return { platformUserId, platformUsername };
        } catch (err) {
            throw new UnauthorizedException(
                `Invalid Telegram session: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
        } finally {
            await this.factory.destroy(client);
        }
    }

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
        { limit, userId, chatId }: BackFillOpts,
        context: PluginContext,
    ): AsyncIterable<StoreResult> {
        context.logger.debug(
            `Starting backfill for user ${userId} chat ${chatId} limit ${limit}`,
        );
        const config = await context.getConfig(userId, this.name);
        if (!config) {
            throw new BadRequestException(
                'Telegram not configured — please add your API credentials in Settings',
            );
        }

        const cfg = config as unknown as TelegramConfig;
        if (!cfg.sessionString) {
            throw new BadRequestException(
                'No active Telegram session — please log in via Settings first',
            );
        }

        if (!cfg.chats?.length) {
            throw new BadRequestException(
                'No chats configured for Telegram backfill — add chat IDs/usernames in plugin settings',
            );
        }

        const chat = cfg.chats.find((c) => c.id === chatId);
        if (!chat) {
            throw new BadRequestException(
                `Chat "${chatId}" not found in Telegram config`,
            );
        }

        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );

        try {
            await client.connect();

            // Mode toggle: 'first' (first N, oldest -> newest) vs 'last' (last N, newest -> oldest)
            const mode = this.config.get<'first' | 'last'>(
                'telegram.backfillMode',
                'last',
            );
            const isFirstN = mode === 'first';
            const reverse = isFirstN;

            context.logger.info(
                `Backfilling ${chat.name} (${chatId}) limit ${limit}`,
            );

            const topicStore = new TelegramTopicStore(
                userId,
                chatId,
                this.config.get<string>('telegram.topicStoreBasePath'),
                this.config.get<string>('telegram.topicStoreFileSuffix'),
            );
            const messageToTopicMap = await topicStore.prewarmChat();
            const pendingTopicEntries: {
                chatId: string;
                messageId: number;
                topicId: number;
            }[] = [];

            const resolvedChatId = /^-?\d+$/.test(chatId)
                ? Number(chatId)
                : chatId;
            const chatEntity = await client.getEntity(resolvedChatId);

            // Resume from last stored offset if in 'first' mode
            let offsetId: number;
            if (isFirstN) {
                const stored = await context.getCursor(
                    this.name,
                    userId,
                    chatId,
                );
                offsetId =
                    stored ??
                    this.config.get<number>('telegram.backfillOffsetId', 1);
            } else {
                offsetId = 0;
            }

            let totalFetched = 0;
            const maxLimit = limit < 0 ? Infinity : limit;

            while (totalFetched < maxLimit) {
                const batchSize = Math.min(
                    this.config.get<number>('telegram.backfillBatchSize', 100),
                    maxLimit - totalFetched,
                );
                /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                const messages: any[] = await client.getMessages(chatEntity, {
                    limit: batchSize,
                    offsetId,
                    reverse,
                });

                if (messages.length === 0) break;

                const chunk: TelegramMessageRaw[] = [];
                for (const msg of messages) {
                    const raw = JSON.parse(JSON.stringify(msg));
                    const topicId = resolveTopicId(msg, raw, messageToTopicMap);
                    messageToTopicMap.set(msg.id as number, topicId);
                    pendingTopicEntries.push({
                        chatId,
                        messageId: msg.id as number,
                        topicId,
                    });
                    chunk.push(normalizeRawMessage(msg, raw, chatId, topicId));
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
                // Save cursor after every batch so resume picks up from here
                if (isFirstN) {
                    await context.saveCursor(
                        this.name,
                        userId,
                        chatId,
                        offsetId,
                    );
                }
                if (messages.length < batchSize) break;
            }
            /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

            if (pendingTopicEntries.length > 0) {
                await topicStore.setBatch(pendingTopicEntries);
            }
        } finally {
            await this.factory.destroy(client);
        }
    }

    async *startStream(
        { userId, chatId }: StreamOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StreamBatch> {
        const config = await context.getConfig(userId, this.name);
        if (!config) {
            throw new BadRequestException('Telegram not configured');
        }

        const cfg = config as unknown as TelegramConfig;
        if (!cfg.sessionString) {
            throw new BadRequestException('No active Telegram session');
        }

        if (!cfg.chats?.length) {
            throw new BadRequestException('No chats configured');
        }

        const chat = cfg.chats.find((c) => c.id === chatId);
        if (!chat) {
            throw new BadRequestException(
                `Chat "${chatId}" not found in Telegram config`,
            );
        }

        const abortSignal = signal ?? new AbortController().signal;

        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );
        await client.connect();

        const resolvedChatId = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
        const chatEntity = await client.getEntity(resolvedChatId);

        const batchSize = this.config.get<number>('streaming.batchSize', 10);
        const maxWindowMs = this.config.get<number>(
            'streaming.maxWindowMs',
            30000,
        );

        let buffer: StreamBatch['envelopes'] = [];
        let lastFlush = Date.now();
        let lastMessageId = 0;

        try {
            while (!abortSignal.aborted) {
                /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                const messages: any[] = await client.getMessages(chatEntity, {
                    limit: batchSize,
                    offsetId: lastMessageId,
                    reverse: false,
                });

                const newMessages = messages.filter(
                    (m: any) => m.id > lastMessageId,
                );

                if (newMessages.length > 0) {
                    for (const msg of newMessages) {
                        const raw = JSON.parse(JSON.stringify(msg));
                        buffer.push(
                            normalizeTelegramMessage(
                                normalizeRawMessage(msg, raw, chatId, null),
                            ),
                        );
                        lastMessageId = msg.id as number;
                    }
                }

                const elapsed = Date.now() - lastFlush;
                if (buffer.length >= batchSize || elapsed >= maxWindowMs) {
                    if (buffer.length > 0) {
                        yield {
                            envelopes: buffer,
                            lastMessageId:
                                buffer.length > 0 ? lastMessageId : undefined,
                        };
                        buffer = [];
                        lastFlush = Date.now();
                    }
                }

                if (newMessages.length === 0) {
                    await this.sleep(1000);
                }
                /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
            }
        } finally {
            buffer = [];
            await this.factory.destroy(client);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
