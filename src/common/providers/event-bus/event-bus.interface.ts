export const EVENT_BUS_TOKEN = Symbol('EVENT_BUS_TOKEN');

export interface IEventBus {
    publish<T>(event: string, payload: T): void;
    subscribe<T>(event: string, handler: (payload: T) => void | Promise<void>): void;
}
