export interface InputMessage {
    envolopId: string;
    sourcePlugin: string;
    type: 'direct' | 'email';
    content: string;
    groupId: string | null;
    channelId: string | null;
    authorId: string | null;
    hasAttachment: boolean;
    replyTo: string | null;
    reactions: Record<string, unknown>;
    pinned: boolean;
    editedDate: string | null;
    entities: Record<string, unknown> | null;
}
