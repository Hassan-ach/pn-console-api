import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { PluginContext, StoreResult } from './plugin-context.interface';
import type {
    BaseProviderConfig,
    ConfigFieldSchema,
    ActivationRequirementResult,
} from './provider-config.interface';

export { ConfigFieldSchema, ActivationRequirementResult };

export interface PlatformUserInfo {
    platformUserId: string;
    platformUsername: string;
}

export interface BackFillOpts {
    limit: number;
    userId: string;
    chatId: string;
}

export interface StreamOpts {
    userId: string;
    chatId: string;
    cursor?: number;
}

export interface StreamBatch {
    envelopes: EnvelopeWithPayload[];
    lastMessageId?: number;
}

export interface ActivationRequirement {
    field: string;
    message: string;
    validate: (config: Record<string, unknown>) => boolean;
}

export interface IPlugin<
    TConfig extends BaseProviderConfig = BaseProviderConfig,
> {
    readonly name: string;

    validateAuth(
        sessionString: string,
        context: PluginContext,
        userId: string,
    ): Promise<PlatformUserInfo>;

    isConnected(
        context: PluginContext,
        userId: string,
        config?: Record<string, unknown>,
    ): Promise<boolean>;

    parseConfig?(raw: Record<string, unknown>): TConfig;

    backfill(
        opts: BackFillOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StoreResult>;

    startStream(
        opts: StreamOpts,
        context: PluginContext,
        signal?: AbortSignal,
    ): AsyncIterable<StreamBatch>;

    getConfigSchema?(): ConfigFieldSchema[];
    getActivationRequirements?(
        config: Record<string, unknown>,
    ): ActivationRequirement[];
}
