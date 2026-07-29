import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PluginContext } from '../../../interfaces/plugin-context.interface';
import type {
    StreamBatch,
    StreamOpts,
} from '../../../interfaces/plugin.interface';
import { TelegramClientFactory } from './telegram-client.factory';
import { normalizeTelegramMessage } from '../utils/normalizer';
import { normalizeRawMessage } from '../utils/telegram-utils';
import { resolvePluginConfig } from '../../../utils/provider-utils';
import type { TelegramConfig } from './telegram-plugin.service';
import { TelegramClient as GramJsClient } from 'telegram';
import { NewMessage } from 'telegram/events';

@Injectable()
export class TelegramStreamService {
    async *run(
        { userId: _userId, chatId, cursor: startCursor }: StreamOpts,
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
        const flushInterval = resolvePluginConfig<number>(
            configService,
            'telegram',
            'providerStreamFlushIntervalMs',
            5000,
            'flushIntervalMs',
        );

        const client: GramJsClient = factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );
        await client.connect();

        let buffer: StreamBatch['envelopes'] = [];
        let lastMessageId = startCursor ?? 0;

        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
        client.addEventHandler(
            (event: any) => {
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
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

        try {
            while (!abortSignal.aborted) {
                await new Promise((resolve) =>
                    setTimeout(resolve, flushInterval),
                );
                if (buffer.length > 0) {
                    const batch = [...buffer];
                    buffer = [];
                    yield { envelopes: batch, lastMessageId };
                }
            }
        } finally {
            await factory.destroy(client);
        }
    }
}
