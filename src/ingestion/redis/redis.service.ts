import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly client: Redis;
    private readonly subscriber: Redis;
    private readonly keyPrefix: string;
    private readonly heartbeatIntervalMs: number;
    private readonly claimTimeoutMs: number;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private claimedKeys: Set<string> = new Set();

    constructor(private readonly config: ConfigService) {
        const url = this.config.get<string>('redis.url', 'redis://localhost:6379');
        this.keyPrefix = this.config.get<string>('redis.keyPrefix', 'pn:console:');
        this.heartbeatIntervalMs = this.config.get<number>('redis.heartbeatIntervalMs', 5_000);
        this.claimTimeoutMs = this.config.get<number>('redis.claimTimeoutMs', 15_000);

        this.client = new Redis(url);
        this.subscriber = new Redis(url);

        this.subscriber.on('message', (channel, message) => {
            this.logger.debug(`Pub/sub message on ${channel}: ${message}`);
        });
    }

    get lockKey(): string {
        return `${this.keyPrefix}lock:`;
    }

    get channelPrefix(): string {
        return `${this.keyPrefix}channel:`;
    }

    async tryAcquireLock(
        resource: string,
        instanceId: string,
    ): Promise<boolean> {
        const key = `${this.lockKey}${resource}`;
        const result = await this.client.set(
            key,
            instanceId,
            'PX',
            this.claimTimeoutMs,
            'NX',
        );
        if (result === 'OK') {
            this.claimedKeys.add(key);
            return true;
        }
        return false;
    }

    async releaseLock(resource: string): Promise<void> {
        const key = `${this.lockKey}${resource}`;
        await this.client.del(key);
        this.claimedKeys.delete(key);
    }

    async heartbeat(resource: string, instanceId: string): Promise<void> {
        const key = `${this.lockKey}${resource}`;
        await this.client.pexpire(key, this.claimTimeoutMs);
    }

    startHeartbeat(resources: string[], instanceId: string): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(async () => {
            for (const resource of resources) {
                try {
                    await this.heartbeat(resource, instanceId);
                } catch (err) {
                    this.logger.error(
                        `Heartbeat failed for ${resource}: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
            }
        }, this.heartbeatIntervalMs);
    }

    stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    async publish(channel: string, message: string): Promise<void> {
        await this.client.publish(`${this.channelPrefix}${channel}`, message);
    }

    async subscribe(channel: string, handler: (msg: string) => void): Promise<void> {
        const fullChannel = `${this.channelPrefix}${channel}`;
        await this.subscriber.subscribe(fullChannel);
        this.subscriber.on('message', (ch, msg) => {
            if (ch === fullChannel) handler(msg);
        });
    }

    async onModuleDestroy(): Promise<void> {
        this.stopHeartbeat();
        for (const key of this.claimedKeys) {
            await this.client.del(key);
        }
        await this.client.quit();
        await this.subscriber.quit();
    }
}
