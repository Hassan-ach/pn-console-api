import { registerAs } from '@nestjs/config';

export default registerAs('ingestion', () => ({
    backfillDayThreshold: 60,
    backfillMode: 'last', // 'first' | 'last'
    backfillBatchSize: 100,
    dbBatchSize: 10,
    dbBatchWindowMs: 5000,
    providerStreamFlushIntervalMs: 5000,
}));
