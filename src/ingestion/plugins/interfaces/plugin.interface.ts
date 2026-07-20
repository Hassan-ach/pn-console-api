import type { EnvelopeWithPayload } from '../../../types/envelope.types';
import type { PluginContext, StoreResult } from './plugin-context.interface';

export type PluginLoginResult =
    | { status: 'ok' }
    | { status: 'need_code'; pendingId: string }
    | { status: 'need_password'; pendingId: string };

export interface BackFillOpts {
    limit: number;
    userId: string;
}

export interface IPlugin {
    readonly name: string;

    isConnected(
        context: PluginContext,
        userId: string,
        config?: Record<string, unknown>,
    ): Promise<boolean>;

    backfill(
        opts: BackFillOpts,
        context: PluginContext,
    ): AsyncIterable<StoreResult>;

    startStream(signal?: AbortSignal): AsyncIterable<EnvelopeWithPayload[]>;

    stopStream(): void;
}
