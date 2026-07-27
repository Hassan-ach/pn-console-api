import { registerAs } from '@nestjs/config';

export default registerAs('streaming', () => ({
    batchSize: 10,
    maxWindowMs: 30000,
    previousInsightLimit: 5,
}));
