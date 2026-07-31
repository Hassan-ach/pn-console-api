import { EventMap } from './events.registry';

export const EVENT_BUS_TOKEN = Symbol('EVENT_BUS_TOKEN');

export type UnsubscribeFn = () => void;

export interface SubscribeOptions {
    retries?: number;
    backoffMs?: number;
}

export interface IEventBus {
    publish<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
    publishAsync?<K extends keyof EventMap>(
        event: K,
        payload: EventMap[K],
    ): Promise<any[]>;
    subscribe<K extends keyof EventMap>(
        event: K,
        handler: (payload: EventMap[K]) => void | Promise<void>,
        options?: SubscribeOptions,
    ): UnsubscribeFn;
}
