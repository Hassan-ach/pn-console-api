import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventBus } from './event-bus.interface';

@Injectable()
export class InMemoryEventBus implements IEventBus {
    constructor(private readonly eventEmitter: EventEmitter2) {}

    publish<T>(event: string, payload: T): void {
        this.eventEmitter.emit(event, payload);
    }

    subscribe<T>(
        event: string,
        handler: (payload: T) => void | Promise<void>,
    ): void {
        this.eventEmitter.on(event, (payload: T) => {
            void Promise.resolve(handler(payload)).catch((err) => {
                console.error(
                    `[InMemoryEventBus] Error in event listener for ${event}:`,
                    err,
                );
            });
        });
    }
}
