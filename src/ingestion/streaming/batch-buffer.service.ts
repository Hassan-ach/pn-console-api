import type { EnvelopeWithPayload } from '../../types/envelope.types';

export class BatchBuffer {
    private buffer: EnvelopeWithPayload[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private batchSize: number,
        private maxWindowMs: number,
        private onFlush: (batch: EnvelopeWithPayload[]) => Promise<void>,
    ) {}

    add(envelope: EnvelopeWithPayload): void {
        this.buffer.push(envelope);
        if (this.buffer.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.maxWindowMs);
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
