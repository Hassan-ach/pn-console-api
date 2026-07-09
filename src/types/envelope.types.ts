export interface EnvelopeData {
    id?: string;
    sourcePlugin: string;
    sourceId: string;
    type: 'message';
    hasAttachment: boolean;
    authorId: string | null;
    occurredAt: Date;
    organizationId?: string;
    status?: string;
    permissions?: Record<string, unknown>;
}

export interface MessagePayloadData {
    id?: string;
    type: 'direct' | 'email';
    content: string;
    groupId: string | null;
    channelId: string | null;
    replyTo: string | null;
    reactions: Record<string, unknown>;
    pinned: boolean;
    editedDate: Date | null;
    entities: Record<string, unknown> | null;
    rawPayload: Record<string, unknown>;
}

export type Payload = MessagePayloadData;

export interface EnvelopeWithPayload<TPayload extends Payload = Payload> {
    envelope: EnvelopeData;
    payload: TPayload;
}
