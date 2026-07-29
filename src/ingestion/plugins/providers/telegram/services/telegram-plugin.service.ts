import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformUserInfo } from '../../../interfaces/plugin.interface';
import type { StoreResult } from '../../../interfaces/plugin-context.interface';
import {
    BaseProviderConfig,
    ProviderChatEntry,
    extractProviderChats,
} from '../../../interfaces/provider-config.interface';
import { BasePluginProvider } from '../../../common/base-plugin-provider';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramBackfillService } from './telegram-backfill.service';
import { TelegramStreamService } from './telegram-stream.service';
import type { PluginContext } from '../../../interfaces/plugin-context.interface';
import type {
    BackFillOpts,
    StreamBatch,
    StreamOpts,
} from '../../../interfaces/plugin.interface';

export interface TelegramConfig extends BaseProviderConfig {
    apiId: number;
    apiHash: string;
    sessionString?: string;
    phone?: string;
    chats: ProviderChatEntry[];
}

@Injectable()
export class TelegramPluginService extends BasePluginProvider<TelegramConfig> {
    readonly name = 'telegram';

    constructor(
        private readonly factory: TelegramClientFactory,
        private readonly config: ConfigService,
        private readonly backfillService: TelegramBackfillService,
        private readonly streamService: TelegramStreamService,
    ) {
        super();
    }

    parseConfig(raw: Record<string, unknown>): TelegramConfig {
        const chats = extractProviderChats(raw);
        return {
            apiId: Number(raw.apiId ?? 0),
            apiHash: String(raw.apiHash ?? ''),
            sessionString:
                typeof raw.sessionString === 'string'
                    ? raw.sessionString
                    : undefined,
            phone: typeof raw.phone === 'string' ? raw.phone : undefined,
            chats,
        };
    }

    async validateAuth(
        sessionString: string,
        context: PluginContext,
        userId: string,
    ): Promise<PlatformUserInfo> {
        const rawConfig = await context.getConfig(userId, this.name);
        if (!rawConfig) {
            throw new BadRequestException(
                'Plugin not configured — save API credentials first',
            );
        }

        const cfg = this.parseConfig(rawConfig);
        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            sessionString,
        );

        try {
            await client.connect();
            const me = await client.getMe();
            const platformUserId = String(me.id);
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

    getConfigSchema() {
        return [
            {
                key: 'apiId',
                label: 'API ID',
                type: 'number' as const,
                required: true,
                placeholder: '123456',
                description: 'Your Telegram API ID from my.telegram.org',
            },
            {
                key: 'apiHash',
                label: 'API Hash',
                type: 'text' as const,
                required: true,
                placeholder: 'abcdef1234567890abcdef1234567890',
                description: 'Your Telegram API hash from my.telegram.org',
            },
            {
                key: 'phone',
                label: 'Phone number',
                type: 'text' as const,
                required: true,
                placeholder: '+19876543210',
                description: 'Phone number with country code',
            },
            {
                key: 'chats',
                label: 'Chats to monitor',
                type: 'checkbox-list' as const,
                required: true,
                description: 'Select which chats to ingest messages from',
            },
        ];
    }

    getActivationRequirements(config: Record<string, unknown>) {
        const chats = extractProviderChats(config);
        return [
            {
                field: 'chats',
                message:
                    'Select at least one chat to monitor before activating',
                validate: () => chats.length > 0,
            },
        ];
    }

    async isConnected(
        context: PluginContext,
        userId: string,
        config?: Record<string, unknown>,
    ): Promise<boolean> {
        const rawCfg = config ?? (await context.getConfig(userId, this.name));
        if (!rawCfg) return false;
        const cfg = this.parseConfig(rawCfg);
        if (!cfg.sessionString) return false;

        const client = this.factory.create(
            cfg.apiId,
            cfg.apiHash,
            cfg.sessionString,
        );
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
        opts: BackFillOpts,
        context: PluginContext,
    ): AsyncIterable<StoreResult> {
        const rawConfig = await context.getConfig(opts.userId, this.name);
        if (!rawConfig) {
            throw new BadRequestException(
                'Telegram not configured — please add your API credentials in Settings',
            );
        }
        const cfg = this.parseConfig(rawConfig);
        yield* this.backfillService.run(
            opts,
            context,
            this.factory,
            this.config,
            cfg,
        );
    }

    async *startStream(
        opts: StreamOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StreamBatch> {
        const rawConfig = await context.getConfig(opts.userId, this.name);
        if (!rawConfig) throw new BadRequestException('Telegram not configured');
        const cfg = this.parseConfig(rawConfig);
        yield* this.streamService.run(
            opts,
            context,
            this.factory,
            this.config,
            cfg,
            signal,
        );
    }
}
