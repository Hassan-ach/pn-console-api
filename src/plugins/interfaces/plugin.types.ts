export interface EnvelopeData {
    source_plugin: string;
    source_id: string;
    type: 'message';
    has_attachment: boolean;
    author_ref: string | null;
    occurred_at: string;
}

export interface MessagePayloadData {
    type: 'direct' | 'email';
    content: string;
    group_id: string | null;
    reply_to: string | null;
    reactions: Record<string, unknown>;
    pinned: boolean;
    edited_date: string | null;
    entities: Record<string, unknown> | null;
    raw_payload: Record<string, unknown>;
}

export type Payload = MessagePayloadData;

export interface EnvelopeWithPayload<TPayload extends Payload = Payload> {
    envelope: EnvelopeData;
    payload: TPayload;
}
