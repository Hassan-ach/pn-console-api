import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient as GramJsClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Production DC IPs for direct TCP connection (vs web.telegram.org which needs WebSocket)
const DC_IPS: Record<number, string> = {
    1: '149.154.175.50',
    2: '149.154.167.51',
    3: '149.154.175.100',
    4: '149.154.167.91',
    5: '149.154.171.5',
} as const;

@Injectable()
export class TelegramClientFactory {
    private readonly logger = new Logger(TelegramClientFactory.name);

    constructor(private readonly config: ConfigService) {}

    create(
        apiId: number,
        apiHash: string,
        sessionString?: string,
        connectionRetries?: number,
    ): GramJsClient {
        const session = sessionString
            ? new StringSession(sessionString)
            : new StringSession('');

        // vesta.web.telegram.org requires WebSocket transport, not TCPFull.
        // Override with the direct DC IP so Node's TCPFull works on port 443.
        if (session.serverAddress?.includes('web.telegram.org')) {
            const ip = DC_IPS[session.dcId] ?? DC_IPS[4];
            session.setDC(session.dcId, ip, 443);
        }

        return new GramJsClient(session, apiId, apiHash, {
            connectionRetries:
                connectionRetries ??
                this.config.get<number>('telegram.connectionRetries', 5),
            useWSS: this.config.get<boolean>('telegram.useWSS', true),
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
