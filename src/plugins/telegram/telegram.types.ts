export interface TelegramMessageRaw {
    id: number;
    chatId: string;
    text: string;
    date: Date;
    replyTo: number | null;
    author: string | null;
    hasAttachment: boolean;
    reactions: Record<string, unknown>;
    pinned: boolean;
    editedDate: string | null;
    entities: Record<string, unknown> | null;
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
