import { Injectable } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { ChatRole } from 'generated/app-db-client';

export interface ChatMessageRecord {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: Date;
}

@Injectable()
export class ChatService {
    constructor(private readonly appDb: AppDbService) {}

    async getHistory(userId: string): Promise<ChatMessageRecord[]> {
        return this.appDb.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
    }

    async saveMessage(
        userId: string,
        role: ChatRole,
        content: string,
    ): Promise<ChatMessageRecord> {
        return this.appDb.chatMessage.create({
            data: {
                userId,
                role,
                content,
            },
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
    }
}
