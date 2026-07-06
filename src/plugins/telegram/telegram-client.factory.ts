import { Injectable, Logger } from '@nestjs/common';
import { TelegramClient as GramJsClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

@Injectable()
export class TelegramClientFactory {
    private readonly logger = new Logger(TelegramClientFactory.name);
    create(
        apiId: number,
        apiHash: string,
        sessionString?: string,
    ): GramJsClient {
        const session = sessionString
            ? new StringSession(sessionString)
            : new StringSession('');

        return new GramJsClient(session, apiId, apiHash, {
            connectionRetries: 5,
        });
    }

    async destroy(client: GramJsClient): Promise<void> {
        try {
            await client.destroy();
        } catch (error) {
            this.logger.error('Error destroying Telegram client', error);
        }
    }
}
