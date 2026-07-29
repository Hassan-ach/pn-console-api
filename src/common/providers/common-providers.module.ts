import { Global, Module } from '@nestjs/common';
import { EVENT_BUS_TOKEN } from './event-bus/event-bus.interface';
import { InMemoryEventBus } from './event-bus/in-memory-event-bus.service';
import { LOCK_MANAGER_TOKEN } from './lock-manager/lock-manager.interface';
import { InMemoryLockManager } from './lock-manager/in-memory-lock-manager.service';
import { CACHE_STORE_TOKEN } from './cache-store/cache-store.interface';
import { InMemoryCacheStore } from './cache-store/in-memory-cache-store.service';

@Global()
@Module({
    providers: [
        {
            provide: EVENT_BUS_TOKEN,
            useClass: InMemoryEventBus,
        },
        {
            provide: LOCK_MANAGER_TOKEN,
            useClass: InMemoryLockManager,
        },
        {
            provide: CACHE_STORE_TOKEN,
            useClass: InMemoryCacheStore,
        },
    ],
    exports: [EVENT_BUS_TOKEN, LOCK_MANAGER_TOKEN, CACHE_STORE_TOKEN],
})
export class CommonProvidersModule {}
