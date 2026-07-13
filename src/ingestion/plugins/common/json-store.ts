import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IStore } from './store.interface';

@Injectable()
export class JsonStore<T extends { id: string }> implements IStore<T> {
    protected cache: T[] | null = null;

    constructor(private readonly filePath: string) {}

    async get(id: string): Promise<T | null> {
        const all = await this.getAll();
        return all.find((item) => item.id === id) ?? null;
    }

    async getAll(): Promise<T[]> {
        if (this.cache) return this.cache;
        try {
            const raw = await fs.readFile(this.filePath, 'utf-8');
            this.cache = JSON.parse(raw) as T[];
        } catch {
            this.cache = [];
        }
        return this.cache;
    }

    async set(id: string, value: T): Promise<void> {
        const all = await this.getAll();
        const idx = all.findIndex((item) => item.id === id);
        if (idx >= 0) {
            all[idx] = value;
        } else {
            all.push(value);
        }
        this.cache = all;
        await this.flush();
    }

    async delete(id: string): Promise<void> {
        const all = await this.getAll();
        this.cache = all.filter((item) => item.id !== id);
        await this.flush();
    }

    protected async flush(): Promise<void> {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
        const tmp = this.filePath + '.tmp';
        await fs.writeFile(tmp, JSON.stringify(this.cache, null, 2));
        await fs.rename(tmp, this.filePath);
    }
}
