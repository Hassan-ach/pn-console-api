import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    keyPrefix: 'pn:console:',
    heartbeatIntervalMs: 5_000,
    claimTimeoutMs: 15_000,
}));
