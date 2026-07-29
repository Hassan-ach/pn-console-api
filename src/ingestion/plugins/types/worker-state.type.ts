export interface WorkerState {
    backfill: 'IDLE' | 'RUNNING' | 'COMPLETED';
    stream: 'IDLE' | 'LISTENING' | 'STOPPED';
    startedAt: Date;
    backfillProgress?: { inserted: number; ids: string[] };
    flushes: number;
}
