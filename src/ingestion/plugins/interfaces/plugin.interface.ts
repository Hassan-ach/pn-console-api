import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { PluginContext, StoreResult } from './plugin-context.interface';

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

export interface IPlugin {
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

    stopStream(opts: StreamOpts): void;

    getConfigSchema?(): Record<string, unknown>[];
    getActivationRequirements?(config: Record<string, unknown>): ActivationRequirement[];
}
