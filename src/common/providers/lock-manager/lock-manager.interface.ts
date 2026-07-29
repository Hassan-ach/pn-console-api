export const LOCK_MANAGER_TOKEN = Symbol('LOCK_MANAGER_TOKEN');

export interface ILockManager {
    acquire(key: string, ownerId: string, ttlMs?: number): Promise<boolean>;
    release(key: string, ownerId: string): Promise<boolean>;
    isLocked(key: string): Promise<boolean>;
}
