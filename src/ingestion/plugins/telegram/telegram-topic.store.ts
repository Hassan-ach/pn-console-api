import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonStore } from '../common/json-store';

interface TopicMappingEntry {
    id: string;
    chatId: string;
    messageId: number;
    topicId: number;
}

@Injectable()
export class TelegramTopicStore extends JsonStore<TopicMappingEntry> {
    constructor(
        orgId: string,
        userId: string,
        chatId: string,
        basePath?: string,
    ) {
        const base = basePath ?? path.join(
            os.homedir(),
            '.pn-console',
            'plugins',
            'telegram',
        );
        const filePath = path.join(
            base,
            orgId,
            userId,
            `${chatId}__topics.json`,
        );
        super(filePath);
    }

    async getTopicId(
        chatId: string,
        messageId: number,
    ): Promise<number | null> {
        const entry = await this.get(`${chatId}:${messageId}`);
        return entry?.topicId ?? null;
    }

    async setTopicId(
        chatId: string,
        messageId: number,
        topicId: number,
    ): Promise<void> {
        await this.set(`${chatId}:${messageId}`, {
            id: `${chatId}:${messageId}`,
            chatId,
            messageId,
            topicId,
        });
    }

    async setBatch(
        entries: { chatId: string; messageId: number; topicId: number }[],
    ): Promise<void> {
        if (entries.length === 0) return;
        const all = await this.getAll();
        for (const { chatId, messageId, topicId } of entries) {
            const id = `${chatId}:${messageId}`;
            const idx = all.findIndex((item) => item.id === id);
            const entry: TopicMappingEntry = { id, chatId, messageId, topicId };
            if (idx >= 0) {
                all[idx] = entry;
            } else {
                all.push(entry);
            }
        }
        this.cache = all;
        await this.flush();
    }

    async prewarmChat(): Promise<Map<number, number>> {
        const all = await this.getAll();
        const map = new Map<number, number>();
        for (const entry of all) {
            map.set(entry.messageId, entry.topicId);
        }
        return map;
    }
}
