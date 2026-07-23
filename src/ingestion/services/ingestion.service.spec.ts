import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IngestionService } from './ingestion.service';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import { EnvelopesIngestedEvent } from '../../intelligence/triggers/envelopes-ingested.event';

async function* asyncGen<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) {
        yield item;
    }
}

describe('IngestionService', () => {
    let service: IngestionService;
    let pluginManager: jest.Mocked<PluginManagerService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IngestionService,
                {
                    provide: PluginManagerService,
                    useValue: { backfill: jest.fn() },
                },
                {
                    provide: EventEmitter2,
                    useValue: { emit: jest.fn() },
                },
            ],
        }).compile();

        service = module.get(IngestionService);
        pluginManager = module.get(PluginManagerService);
        eventEmitter = module.get(EventEmitter2);
    });

    it('returns inserted count and no errors on success', async () => {
        pluginManager.backfill.mockReturnValue(
            asyncGen([{ inserted: 5, ids: ['a', 'b', 'c', 'd', 'e'] }]),
        );

        const result = await service.ingest({
            plugins: [{ name: 'telegram', limit: 10 }],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(5);
        expect(result.errors).toEqual([]);
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'envelopes.ingested',
            expect.any(EnvelopesIngestedEvent),
        );
    });

    it('collects errors without stopping other plugins', async () => {
        pluginManager.backfill.mockImplementation((name: string) =>
            name === 'bad'
                ? (() => {
                      throw new Error('fail');
                  })()
                : asyncGen([{ inserted: 3, ids: ['x', 'y', 'z'] }]),
        );

        const result = await service.ingest({
            plugins: [
                { name: 'bad', limit: 5 },
                { name: 'good', limit: 5 },
            ],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(3);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].plugin).toBe('bad');
        expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it('sums inserted across multiple plugins and chunks', async () => {
        pluginManager.backfill.mockImplementation((name: string) => {
            if (name === 'a') {
                return asyncGen([
                    { inserted: 3, ids: ['a1', 'a2', 'a3'] },
                    { inserted: 2, ids: ['a4', 'a5'] },
                ]);
            }
            return asyncGen([{ inserted: 4, ids: ['b1', 'b2', 'b3', 'b4'] }]);
        });

        const result = await service.ingest({
            plugins: [
                { name: 'a', limit: 10 },
                { name: 'b', limit: 10 },
            ],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(9);
        expect(result.errors).toEqual([]);
    });
});
