import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    IEventBus,
    SubscribeOptions,
    UnsubscribeFn,
} from './event-bus.interface';
import { EventMap } from './events.registry';

@Injectable()
export class InMemoryEventBus implements IEventBus {
    private readonly logger = new Logger(InMemoryEventBus.name);

    constructor(private readonly eventEmitter: EventEmitter2) {}

    publish<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
        this.eventEmitter.emit(event, payload);
    }

    async publishAsync<K extends keyof EventMap>(
        event: K,
        payload: EventMap[K],
    ): Promise<any[]> {
        return this.eventEmitter.emitAsync(event, payload);
    }

    subscribe<K extends keyof EventMap>(
        event: K,
        handler: (payload: EventMap[K]) => void | Promise<void>,
        options?: SubscribeOptions,
    ): UnsubscribeFn {
        const listener = (payload: EventMap[K]) => {
            void this.executeHandlerWithRetry(event, handler, payload, options);
        };

        this.eventEmitter.on(event, listener);
        return () => {
            this.eventEmitter.off(event, listener);
        };
    }

    private async executeHandlerWithRetry<K extends keyof EventMap>(
        event: K,
        handler: (payload: EventMap[K]) => void | Promise<void>,
        payload: EventMap[K],
        options?: SubscribeOptions,
    ): Promise<void> {
        const maxRetries = options?.retries ?? 0;
        const initialBackoff = options?.backoffMs ?? 1000;

        let attempt = 0;
        while (attempt <= maxRetries) {
            try {
                await handler(payload);
                return;
            } catch (error) {
                attempt++;
                if (attempt > maxRetries) {
                    this.logger.error(
                        `[InMemoryEventBus] Error in event listener for ${String(event)} after ${maxRetries + 1} attempt(s): ${(error as Error).message}`,
                        (error as Error).stack,
                    );
                    return;
                }
                const backoff = initialBackoff * Math.pow(2, attempt - 1);
                this.logger.warn(
                    `[InMemoryEventBus] Event listener for '${String(event)}' failed (attempt ${attempt}/${maxRetries + 1}). Retrying in ${backoff}ms... Error: ${(error as Error).message}`,
                );
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }
}
