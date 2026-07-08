export interface ResolvedEntity {
    type: string;
    value: string | number | null;
    raw: Record<string, unknown>;
}

export interface TelegramMessageRaw {
    id: number;
    channel_id: string | null;
    text: string;
    date: Date;
    replyTo: number | null;
    author_id: string | null;
    hasAttachment: boolean;
    reactions: Record<string, unknown>;
    pinned: boolean;
    editedDate: string | null;
    resolved_entities: ResolvedEntity[] | null;
    raw: Record<string, unknown>;
}

export interface TelegramSession {
    id: string;
    phone: string;
    sessionString: string;
    createdAt: string;
    updatedAt: string;
}

export interface PendingAuth {
    id: string;
    phone: string;
    phoneCodeHash: string;
    expiresAt: string;
}
