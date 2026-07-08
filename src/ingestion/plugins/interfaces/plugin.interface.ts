import { EnvelopeWithPayload, Payload } from './plugin.types';

export type PluginLoginResult =
    | { status: 'ok' }
    | { status: 'need_code'; pendingId: string }
    | { status: 'need_password'; pendingId: string };

export interface IPlugin<TPayload extends Payload = Payload> {
    readonly name: string;

    initialize(config: Record<string, unknown>): Promise<void>;

    login(credentials: Record<string, unknown>): Promise<PluginLoginResult>;

    logout(): Promise<void>;

    backfill(
        limit: number,
    ): AsyncIterable<EnvelopeWithPayload<TPayload>[]>;

    startStream(signal?: AbortSignal): AsyncIterable<EnvelopeWithPayload<TPayload>[]>;

    stopStream(): void;

    handleAction(action: string, params: Record<string, unknown>): Promise<unknown>;
}
