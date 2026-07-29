import { Injectable } from '@nestjs/common';
import { ILockManager } from './lock-manager.interface';

interface LockEntry {
    ownerId: string;
    expiresAt: number | null;
}

@Injectable()
export class InMemoryLockManager implements ILockManager {
    private readonly locks = new Map<string, LockEntry>();

    acquire(key: string, ownerId: string, ttlMs?: number): Promise<boolean> {
        const now = Date.now();
        const existing = this.locks.get(key);

        if (existing) {
            if (existing.expiresAt !== null && existing.expiresAt <= now) {
                this.locks.delete(key);
            } else if (existing.ownerId !== ownerId) {
                return Promise.resolve(false);
            }
        }

        const expiresAt = ttlMs ? now + ttlMs : null;
        this.locks.set(key, { ownerId, expiresAt });
        return Promise.resolve(true);
    }

    release(key: string, ownerId: string): Promise<boolean> {
        const existing = this.locks.get(key);
        if (!existing) return Promise.resolve(true);

        if (existing.ownerId === ownerId) {
            this.locks.delete(key);
            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    }

    isLocked(key: string): Promise<boolean> {
        const now = Date.now();
        const existing = this.locks.get(key);
        if (!existing) return Promise.resolve(false);

        if (existing.expiresAt !== null && existing.expiresAt <= now) {
            this.locks.delete(key);
            return Promise.resolve(false);
        }

        return Promise.resolve(true);
    }
}
