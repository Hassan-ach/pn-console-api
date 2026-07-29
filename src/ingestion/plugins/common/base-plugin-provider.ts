import {
    ActivationRequirement,
    BackFillOpts,
    ConfigFieldSchema,
    IPlugin,
    PlatformUserInfo,
    StreamBatch,
    StreamOpts,
} from '../interfaces/plugin.interface';
import { PluginContext, StoreResult } from '../interfaces/plugin-context.interface';
import {
    BaseProviderConfig,
    ProviderChatEntry,
    extractProviderChats,
} from '../interfaces/provider-config.interface';

export abstract class BasePluginProvider<
    TConfig extends BaseProviderConfig = BaseProviderConfig,
> implements IPlugin<TConfig>
{
    abstract readonly name: string;

    abstract validateAuth(
        sessionString: string,
        context: PluginContext,
        userId: string,
    ): Promise<PlatformUserInfo>;

    abstract isConnected(
        context: PluginContext,
        userId: string,
        config?: Record<string, unknown>,
    ): Promise<boolean>;

    abstract backfill(
        opts: BackFillOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StoreResult>;

    abstract startStream(
        opts: StreamOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StreamBatch>;

    getConfigSchema(): ConfigFieldSchema[] {
        return [];
    }

    getActivationRequirements(
        _config: Record<string, unknown>,
    ): ActivationRequirement[] {
        return [];
    }

    parseConfig(raw: Record<string, unknown>): TConfig {
        const chats = extractProviderChats(raw);
        return {
            ...raw,
            chats,
        } as TConfig;
    }

    protected extractChats(config: TConfig): ProviderChatEntry[] {
        return config.chats ?? [];
    }
}
