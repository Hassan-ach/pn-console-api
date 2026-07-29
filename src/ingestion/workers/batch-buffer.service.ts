export class BatchBuffer<T = unknown> {
    private buffer: T[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private batchSize: number,
        private maxWindowMs: number,
        private onFlush: (batch: T[]) => Promise<void>,
    ) {}

    add(item: T): void {
        this.buffer.push(item);
        if (this.buffer.length >= this.batchSize) {
            void this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => {
                void this.flush();
            }, this.maxWindowMs);
        }
    }

    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        const batch = this.buffer.splice(0);
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        await this.onFlush(batch);
    }
}
