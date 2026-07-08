import { Test, TestingModule } from '@nestjs/testing';
import { InsightPersistenceService } from './insight-persistence.service';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Insight } from '../../types';

describe('InsightPersistenceService', () => {
  let service: InsightPersistenceService;
  let tx: {
    insight: { create: jest.Mock; update: jest.Mock };
    insightVersion: { groupBy: jest.Mock; createMany: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      insight: {
        create: jest.fn(),
        update: jest.fn(),
      },
      insightVersion: {
        groupBy: jest.fn(),
        createMany: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightPersistenceService,
        { provide: AppDbService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InsightPersistenceService>(InsightPersistenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('persistAll', () => {
    it('does nothing when given an empty array', async () => {
      await service.persistAll([]);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new insight with version 1 when id is null', async () => {
      const insight: Insight = {
        id: null,
        type: 'TASK',
        content: 'Follow up with client',
        owners: ['owner-1'],
      };

      tx.insight.create.mockResolvedValue({ id: 'generated-id' });

      await service.persistAll([insight]);

      expect(tx.insight.create).toHaveBeenCalledWith({
        data: {
          versions: {
            create: {
              version: 1,
              type: 'TASK',
              content: 'Follow up with client',
              owners: ['owner-1'],
            },
          },
        },
        select: { id: true },
      });

      // No existing-insight logic should run
      expect(tx.insight.update).not.toHaveBeenCalled();
      expect(tx.insightVersion.groupBy).not.toHaveBeenCalled();
      expect(tx.insightVersion.createMany).not.toHaveBeenCalled();
    });

    it('appends the next version for an existing insight', async () => {
      const insight: Insight = {
        id: 'existing-id',
        type: 'DECISION',
        content: 'Approved budget increase',
        owners: ['owner-2'],
      };

      tx.insightVersion.groupBy.mockResolvedValue([
        { insightId: 'existing-id', _max: { version: 3 } },
      ]);

      await service.persistAll([insight]);

      expect(tx.insight.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {},
      });

      expect(tx.insightVersion.groupBy).toHaveBeenCalledWith({
        by: ['insightId'],
        where: { insightId: { in: ['existing-id'] } },
        _max: { version: true },
      });

      expect(tx.insightVersion.createMany).toHaveBeenCalledWith({
        data: [
          {
            insightId: 'existing-id',
            version: 4,
            type: 'DECISION',
            content: 'Approved budget increase',
            owners: ['owner-2'],
          },
        ],
      });

      expect(tx.insight.create).not.toHaveBeenCalled();
    });

    it('defaults to version 1 for an existing id with no prior versions', async () => {
      const insight: Insight = {
        id: 'existing-id-no-versions',
        type: 'INFO',
        content: 'Some info',
        owners: [],
      };

      tx.insightVersion.groupBy.mockResolvedValue([]); // no rows found

      await service.persistAll([insight]);

      expect(tx.insightVersion.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            insightId: 'existing-id-no-versions',
            version: 1,
          }),
        ],
      });
    });

    it('handles a mixed batch of new and existing insights independently', async () => {
      const newInsight: Insight = {
        id: null,
        type: 'URGENCY',
        content: 'New urgent item',
        owners: ['owner-3'],
      };
      const existingInsight: Insight = {
        id: 'existing-id',
        type: 'TASK',
        content: 'Existing task update',
        owners: ['owner-4'],
      };

      tx.insight.create.mockResolvedValue({ id: 'generated-id' });
      tx.insightVersion.groupBy.mockResolvedValue([
        { insightId: 'existing-id', _max: { version: 1 } },
      ]);

      await service.persistAll([newInsight, existingInsight]);

      expect(tx.insight.create).toHaveBeenCalledTimes(1);
      expect(tx.insight.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {},
      });
      expect(tx.insightVersion.groupBy).toHaveBeenCalledWith({
        by: ['insightId'],
        where: { insightId: { in: ['existing-id'] } },
        _max: { version: true },
      });
      expect(tx.insightVersion.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ insightId: 'existing-id', version: 2 }),
        ],
      });
    });

    it('batches version lookups for multiple existing insights in a single groupBy call', async () => {
      const insights: Insight[] = [
        { id: 'id-a', type: 'TASK', content: 'A', owners: [] },
        { id: 'id-b', type: 'INFO', content: 'B', owners: [] },
      ];

      tx.insightVersion.groupBy.mockResolvedValue([
        { insightId: 'id-a', _max: { version: 2 } },
        { insightId: 'id-b', _max: { version: 5 } },
      ]);

      await service.persistAll(insights);

      expect(tx.insightVersion.groupBy).toHaveBeenCalledTimes(1);
      expect(tx.insightVersion.groupBy).toHaveBeenCalledWith({
        by: ['insightId'],
        where: { insightId: { in: ['id-a', 'id-b'] } },
        _max: { version: true },
      });

      expect(tx.insightVersion.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ insightId: 'id-a', version: 3 }),
          expect.objectContaining({ insightId: 'id-b', version: 6 }),
        ],
      });
    });

    it('propagates errors from the transaction', async () => {
      const insight: Insight = {
        id: 'existing-id',
        type: 'TASK',
        content: 'Will fail',
        owners: [],
      };

      const error = new Error('DB is down');
      prisma.$transaction.mockRejectedValueOnce(error);

      await expect(service.persistAll([insight])).rejects.toThrow('DB is down');
    });
  });

  describe('persist', () => {
    it('delegates to persistAll with a single-element array', async () => {
      const insight: Insight = {
        id: null,
        type: 'TASK',
        content: 'Single insight',
        owners: ['owner-1'],
      };

      const spy = jest
        .spyOn(service, 'persistAll')
        .mockResolvedValue(undefined);

      await service.persist(insight);

      expect(spy).toHaveBeenCalledWith([insight]);
    });
  });
});
