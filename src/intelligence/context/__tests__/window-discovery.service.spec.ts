import { Test, TestingModule } from '@nestjs/testing';
import { WindowDiscoveryService } from '../window-discovery.service';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';

describe('WindowDiscoveryService', () => {
    let service: WindowDiscoveryService;
    let rawDb: jest.Mocked<RawDbService>;

    beforeEach(async () => {
        rawDb = {
            $queryRawUnsafe: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WindowDiscoveryService,
                { provide: RawDbService, useValue: rawDb },
            ],
        }).compile();

        service = module.get(WindowDiscoveryService);
    });

    it('returns empty array when no envelopes exist', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([]);

        const result = await service.discoverWindows('org-1');

        expect(result).toEqual([]);
        expect(rawDb.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('returns windows from raw query result', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([
            {
                window_start: new Date('2026-07-01'),
                window_end: new Date('2026-07-03'),
                message_count: BigInt(500),
            },
            {
                window_start: new Date('2026-07-04'),
                window_end: new Date('2026-07-04'),
                message_count: BigInt(100),
            },
        ]);

        const result = await service.discoverWindows('org-1');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            start: new Date('2026-07-01'),
            end: new Date('2026-07-03'),
            messageCount: 500,
        });
        expect(result[1]).toEqual({
            start: new Date('2026-07-04'),
            end: new Date('2026-07-04'),
            messageCount: 100,
        });
    });

    it('passes organizationId to SQL query', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([]);

        await service.discoverWindows('org-42');

        expect(rawDb.$queryRawUnsafe).toHaveBeenCalledWith(
            expect.stringContaining('organization_id'),
            'org-42',
            null,
            null,
            1000,
        );
    });

    it('passes minMessages option to SQL query', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([]);

        await service.discoverWindows('org-1', { minMessages: 50 });

        expect(rawDb.$queryRawUnsafe).toHaveBeenCalledWith(
            expect.any(String),
            'org-1',
            null,
            null,
            50,
        );
    });

    it('passes windowStart and windowEnd to SQL query', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([]);
        const start = new Date('2026-06-01');
        const end = new Date('2026-06-30');

        await service.discoverWindows('org-1', {
            windowStart: start,
            windowEnd: end,
        });

        expect(rawDb.$queryRawUnsafe).toHaveBeenCalledWith(
            expect.any(String),
            'org-1',
            start,
            end,
            1000,
        );
    });

    it('uses default minMessages of 1000 when not specified', async () => {
        rawDb.$queryRawUnsafe.mockResolvedValue([]);

        await service.discoverWindows('org-1');

        expect(rawDb.$queryRawUnsafe).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(Object),
            1000,
        );
    });
});
