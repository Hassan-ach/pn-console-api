import { Injectable } from '@nestjs/common';
import { ICacheStore } from './cache-store.interface';

interface CacheEntry<T> {
    value: T;
    expiresAt: number | null;
}

@Injectable()
export class InMemoryCacheStore implements ICacheStore {
    private readonly store = new Map<string, CacheEntry<unknown>>();

    async get<T>(key: string): Promise<T | null> {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }

        return entry.value as T;
    }

    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const expiresAt = ttlMs ? Date.now() + ttlMs : null;
        this.store.set(key, { value, expiresAt });
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }
}
