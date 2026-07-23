import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TelegramTopicStore } from './telegram-topic.store';

let tmpDir: string;
let store: TelegramTopicStore;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-topic-test-'));
    store = new TelegramTopicStore('user1', 'chat1', tmpDir, '__topics.json');
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('TelegramTopicStore', () => {
    describe('getTopicId / setTopicId', () => {
        it('returns null for unknown message', async () => {
            await expect(store.getTopicId('chat1', 999)).resolves.toBeNull();
        });

        it('stores and retrieves a topic mapping', async () => {
            await store.setTopicId('chat1', 42, 7);
            await expect(store.getTopicId('chat1', 42)).resolves.toBe(7);
        });
    });

    describe('setBatch', () => {
        it('adds multiple entries', async () => {
            await store.setBatch([
                { chatId: 'chat1', messageId: 1, topicId: 10 },
                { chatId: 'chat1', messageId: 2, topicId: 20 },
            ]);
            await expect(store.getTopicId('chat1', 1)).resolves.toBe(10);
            await expect(store.getTopicId('chat1', 2)).resolves.toBe(20);
        });

        it('updates existing entries', async () => {
            await store.setTopicId('chat1', 1, 10);
            await store.setBatch([{ chatId: 'chat1', messageId: 1, topicId: 99 }]);
            await expect(store.getTopicId('chat1', 1)).resolves.toBe(99);
        });

        it('no-ops on empty array', async () => {
            await store.setBatch([]);
            await expect(store.getTopicId('chat1', 1)).resolves.toBeNull();
        });
    });

    describe('prewarmChat', () => {
        it('returns empty map when no entries', async () => {
            const map = await store.prewarmChat();
            expect(map.size).toBe(0);
        });

        it('returns map of messageId → topicId', async () => {
            await store.setTopicId('chat1', 1, 10);
            await store.setTopicId('chat1', 2, 20);
            const map = await store.prewarmChat();
            expect(map.get(1)).toBe(10);
            expect(map.get(2)).toBe(20);
            expect(map.size).toBe(2);
        });
    });
});
