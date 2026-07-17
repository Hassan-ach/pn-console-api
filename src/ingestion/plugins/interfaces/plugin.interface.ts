import { EnvelopeWithPayload, Payload } from '../../../types/envelope.types';

export type PluginLoginResult =
    | { status: 'ok' }
    | { status: 'need_code'; pendingId: string }
    | { status: 'need_password'; pendingId: string };

export interface BackFillOpts {
    limit: number;
    userId: string;
}

export interface IPlugin<TPayload extends Payload = Payload> {
    readonly name: string;

    backfill(
        opts: BackFillOpts
    ): AsyncIterable<EnvelopeWithPayload<TPayload>[]>;

    startStream(
        signal?: AbortSignal,
    ): AsyncIterable<EnvelopeWithPayload<TPayload>[]>;

    stopStream(): void;
}
