export interface IStore<T extends { id: string }> {
    get(id: string): Promise<T | null>;
    getAll(): Promise<T[]>;
    set(id: string, value: T): Promise<void>;
    delete(id: string): Promise<void>;
}
