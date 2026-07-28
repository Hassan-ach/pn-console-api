import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IngestionService } from './ingestion.service';
import { IngestionRunnerService } from './ingestion-runner.service';
import { EnvelopesIngestedEvent } from '../../intelligence/triggers/envelopes-ingested.event';

describe('IngestionService', () => {
    let service: IngestionService;
    let ingestionRunner: jest.Mocked<IngestionRunnerService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IngestionService,
                {
                    provide: IngestionRunnerService,
                    useValue: { backfillPlugin: jest.fn() },
                },
                {
                    provide: EventEmitter2,
                    useValue: { emit: jest.fn() },
                },
            ],
        }).compile();

        service = module.get(IngestionService);
        ingestionRunner = module.get(IngestionRunnerService);
        eventEmitter = module.get(EventEmitter2);
    });

    it('returns inserted count and no errors on success', async () => {
        ingestionRunner.backfillPlugin.mockResolvedValue({
            chatResults: [
                { chatId: 'c1', chatName: 'Chat', inserted: 5, error: null },
            ],
        });

        const result = await service.ingest({
            plugins: [
                {
                    name: 'telegram',
                    chats: [{ chatId: 'c1', chatName: 'Chat', limit: 10 }],
                },
            ],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(5);
        expect(result.errors).toEqual([]);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'envelopes.ingested',
            expect.any(EnvelopesIngestedEvent),
        );
    });

    it('collects errors without stopping other plugins', async () => {
        ingestionRunner.backfillPlugin.mockImplementation((name: string) =>
            Promise.resolve(
                name === 'bad'
                    ? {
                          chatResults: [
                              {
                                  chatId: 'c1',
                                  chatName: 'Bad',
                                  inserted: 0,
                                  error: 'fail',
                              },
                          ],
                      }
                    : {
                          chatResults: [
                              {
                                  chatId: 'c2',
                                  chatName: 'Good',
                                  inserted: 3,
                                  error: null,
                              },
                          ],
                      },
            ),
        );

        const result = await service.ingest({
            plugins: [
                {
                    name: 'bad',
                    chats: [{ chatId: 'c1', chatName: 'Bad', limit: 5 }],
                },
                {
                    name: 'good',
                    chats: [{ chatId: 'c2', chatName: 'Good', limit: 5 }],
                },
            ],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(3);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].plugin).toBe('bad/Bad');
    });

    it('sums inserted across multiple plugins', async () => {
        ingestionRunner.backfillPlugin.mockImplementation((name: string) =>
            Promise.resolve(
                name === 'a'
                    ? {
                          chatResults: [
                              {
                                  chatId: 'c1',
                                  chatName: 'A',
                                  inserted: 5,
                                  error: null,
                              },
                          ],
                      }
                    : {
                          chatResults: [
                              {
                                  chatId: 'c2',
                                  chatName: 'B',
                                  inserted: 4,
                                  error: null,
                              },
                          ],
                      },
            ),
        );

        const result = await service.ingest({
            plugins: [
                {
                    name: 'a',
                    chats: [{ chatId: 'c1', chatName: 'A', limit: 10 }],
                },
                {
                    name: 'b',
                    chats: [{ chatId: 'c2', chatName: 'B', limit: 10 }],
                },
            ],
            userId: 'u1',
            organizationId: 'org-1',
        });

        expect(result.inserted).toBe(9);
        expect(result.errors).toEqual([]);
    });
});
