import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PluginContext } from '../../../interfaces/plugin-context.interface';
import type { StreamBatch, StreamOpts } from '../../../interfaces/plugin.interface';
import { TelegramClientFactory } from './telegram-client.factory';
import { normalizeTelegramMessage } from '../utils/normalizer';
import { normalizeRawMessage } from '../utils/telegram-utils';
import type { TelegramConfig } from './telegram-plugin.service';
import { TelegramClient as GramJsClient } from 'telegram';
import { NewMessage } from 'telegram/events';

@Injectable()
export class TelegramStreamService {
    async *run(
        { userId, chatId, cursor: startCursor }: StreamOpts,
        context: PluginContext,
        factory: TelegramClientFactory,
        configService: ConfigService,
        cfg: TelegramConfig,
        signal?: AbortSignal,
    ): AsyncIterable<StreamBatch> {
        if (!cfg.sessionString)
            throw new BadRequestException('No active Telegram session');
        if (!cfg.chats.length)
            throw new BadRequestException('No chats configured');

        const chat = cfg.chats.find((c) => c.id === chatId);
        if (!chat) {
            throw new BadRequestException(
                `Chat "${chatId}" not found in Telegram config`,
            );
        }

        const abortSignal = signal ?? new AbortController().signal;
        const flushInterval = configService.get<number>(
            'streaming.flushIntervalMs',
            3000,
        );

        const client: GramJsClient = factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );
        await client.connect();

        let buffer: StreamBatch['envelopes'] = [];
        let lastMessageId = startCursor ?? 0;

        client.addEventHandler(
            async (event: any) => {
                const msg = event.message;
                if (!msg) return;

                const msgId = Number(msg.id);
                if (msgId <= lastMessageId) return;

                const raw = msg.toJSON ? msg.toJSON() : {};

                buffer.push(
                    normalizeTelegramMessage(
                        normalizeRawMessage(msg, raw, chatId, null),
                    ),
                );
                lastMessageId = msgId;
            },
            new NewMessage({ chats: [chatId] }),
        );

        try {
            while (!abortSignal.aborted) {
                await new Promise<void>((resolve) => {
                    const timer = setTimeout(resolve, flushInterval);
                    const onAbort = () => {
                        clearTimeout(timer);
                        resolve();
                    };
                    abortSignal.addEventListener('abort', onAbort, {
                        once: true,
                    });
                });

                if (abortSignal.aborted) break;

                if (buffer.length > 0) {
                    const batch = buffer;
                    buffer = [];

                    yield {
                        envelopes: batch,
                        lastMessageId,
                    };
                }
            }

            if (buffer.length > 0) {
                yield { envelopes: buffer, lastMessageId };
                buffer = [];
            }
        } finally {
            await factory.destroy(client);
        }
    }
}
