import {
    BadRequestException,
    Injectable,
    NotImplementedException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPlugin, PlatformUserInfo } from '../interfaces/plugin.interface';
import type { StoreResult } from '../interfaces/plugin-context.interface';
import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramTopicStore } from './telegram-topic.store';
import { normalizeTelegramMessage } from './normalizer';
import { resolveEntities, resolveTopicId } from './telegram-utils';
import type { PluginContext } from '../interfaces/plugin-context.interface';
import type { TelegramMessageRaw } from './telegram.types';
import type { BackFillOpts } from '../interfaces/plugin.interface';

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
        { limit, userId }: BackFillOpts,
        context: PluginContext,
    ): AsyncIterable<StoreResult> {
        context.logger.debug(
            `Starting backfill for user ${userId} with limit ${limit}`,
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

            for (const chat of cfg.chats) {
                const chatId = chat.id;
                context.logger.info(
                    `Backfilling ${chat.name} (${chatId}) limit ${limit}`,
                );

                const topicStore = new TelegramTopicStore(userId, chatId);
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
                        this.config.get<number>(
                            'telegram.backfillBatchSize',
                            100,
                        ),
                        maxLimit - totalFetched,
                    );
                    const messages: any[] = await client.getMessages(
                        chatEntity,
                        {
                            limit: batchSize,
                            offsetId,
                            reverse,
                        },
                    );

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

                if (pendingTopicEntries.length > 0) {
                    await topicStore.setBatch(pendingTopicEntries);
                }
            }
        } finally {
            await this.factory.destroy(client);
        }
    }

    async *startStream(): AsyncIterable<EnvelopeWithPayload[]> {
        throw new NotImplementedException('Streaming not implemented yet');
    }

    stopStream(): void {
        // Not implemented yet
    }
}
