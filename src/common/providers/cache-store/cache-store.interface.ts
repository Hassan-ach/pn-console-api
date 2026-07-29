export const CACHE_STORE_TOKEN = Symbol('CACHE_STORE_TOKEN');

export interface ICacheStore {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
}
