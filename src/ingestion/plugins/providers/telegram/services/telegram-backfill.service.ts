import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    PluginContext,
    StoreResult,
} from '../../../interfaces/plugin-context.interface';
import type { BackFillOpts } from '../../../interfaces/plugin.interface';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramTopicStore } from './telegram-topic.store';
import { normalizeTelegramMessage } from '../utils/normalizer';
import { normalizeRawMessage, resolveTopicId } from '../utils/telegram-utils';
import type { TelegramConfig } from './telegram-plugin.service';
import type { TelegramMessageRaw } from '../types/telegram.types';

@Injectable()
export class TelegramBackfillService {
    async *run(
        { limit, userId, chatId }: BackFillOpts,
        context: PluginContext,
        factory: TelegramClientFactory,
        configService: ConfigService,
        cfg: TelegramConfig,
    ): AsyncIterable<StoreResult> {
        context.logger.debug(
            `Starting backfill for user ${userId} chat ${chatId} limit ${limit}`,
        );

        if (!cfg.sessionString) {
            throw new BadRequestException(
                'No active Telegram session — please log in via Settings first',
            );
        }

        if (!cfg.chats.length) {
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

        const client = factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );

        try {
            await client.connect();

            const mode = configService.get<'first' | 'last'>(
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
                configService.get<string>('telegram.topicStoreBasePath'),
                configService.get<string>('telegram.topicStoreFileSuffix'),
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

            const storedCursor = await context.getCursor(
                'telegram',
                userId,
                chatId,
            );

            let offsetId: number;
            if (isFirstN) {
                offsetId =
                    storedCursor ??
                    configService.get<number>('telegram.backfillOffsetId', 1);
            } else {
                offsetId = 0;
            }

            let totalFetched = 0;
            let maxMsgId = storedCursor ?? 0;
            const maxLimit = limit < 0 ? Infinity : limit;

            while (totalFetched < maxLimit) {
                const batchSize = Math.min(
                    configService.get<number>(
                        'telegram.backfillBatchSize',
                        100,
                    ),
                    maxLimit - totalFetched,
                );
                /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                const queryOpts: Record<string, any> = {
                    limit: batchSize,
                    offsetId,
                    reverse,
                };
                if (!isFirstN && storedCursor && storedCursor > 0) {
                    queryOpts.minId = storedCursor;
                }

                const messages: any[] = await client.getMessages(
                    chatEntity,
                    queryOpts,
                );

                if (!messages || messages.length === 0) break;

                const chunk: TelegramMessageRaw[] = [];
                let stopGapFill = false;
                for (const msg of messages) {
                    const msgId = Number(msg.id);
                    if (
                        !isFirstN &&
                        storedCursor &&
                        storedCursor > 0 &&
                        msgId <= storedCursor
                    ) {
                        stopGapFill = true;
                        continue;
                    }

                    if (msgId > maxMsgId) {
                        maxMsgId = msgId;
                    }

                    const raw = JSON.parse(JSON.stringify(msg));
                    const topicId = resolveTopicId(msg, raw, messageToTopicMap);
                    messageToTopicMap.set(msgId, topicId);
                    pendingTopicEntries.push({
                        chatId,
                        messageId: msgId,
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

                if (stopGapFill) break;

                totalFetched += messages.length;
                offsetId = messages[messages.length - 1].id as number;
                if (isFirstN) {
                    await context.saveCursor(
                        'telegram',
                        userId,
                        chatId,
                        offsetId,
                    );
                }
                if (messages.length < batchSize) break;
            }

            if (maxMsgId > (storedCursor ?? 0)) {
                await context.saveCursor('telegram', userId, chatId, maxMsgId);
            }
            /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

            if (pendingTopicEntries.length > 0) {
                await topicStore.setBatch(pendingTopicEntries);
            }
        } finally {
            await factory.destroy(client);
        }
    }
}
