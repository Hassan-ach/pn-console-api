import { ConfigService } from '@nestjs/config';
import { TelegramBackfillService } from './telegram-backfill.service';
import type { PluginContext } from '../../../interfaces/plugin-context.interface';
import { TelegramClientFactory } from './telegram-client.factory';

describe('TelegramBackfillService', () => {
    let service: TelegramBackfillService;
    let mockContext: jest.Mocked<PluginContext>;
    let mockFactory: jest.Mocked<TelegramClientFactory>;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockClient: any;

    beforeEach(() => {
        service = new TelegramBackfillService();

        mockContext = {
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            getConfig: jest.fn(),
            saveConfig: jest.fn(),
            updateConfig: jest.fn(),
            storeUserMapping: jest.fn(),
            getCursor: jest.fn(),
            saveCursor: jest.fn(),
            storeEnvelopes: jest.fn().mockResolvedValue({ inserted: 1, ids: ['env-1'] }),
            resolveOrgId: jest.fn().mockReturnValue('org-1'),
            resolveOrgIdAsync: jest.fn().mockResolvedValue('org-1'),
        };

        mockClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            getEntity: jest.fn().mockResolvedValue({ id: 12345 }),
            getMessages: jest.fn(),
        };

        mockFactory = {
            create: jest.fn().mockReturnValue(mockClient),
            destroy: jest.fn().mockResolvedValue(undefined),
        } as any;

        mockConfigService = {
            get: jest.fn().mockImplementation((key, defaultVal) => {
                if (key === 'telegram.backfillMode') return 'last';
                if (key === 'telegram.backfillBatchSize') return 100;
                return defaultVal;
            }),
        } as any;
    });

    it('should gap fill using minId when stored cursor exists', async () => {
        mockContext.getCursor.mockResolvedValue(500);
        mockClient.getMessages.mockResolvedValue([
            { id: 502, date: 1600000000, message: 'msg 502' },
            { id: 501, date: 1600000000, message: 'msg 501' },
        ]);

        const cfg = {
            apiId: 123,
            apiHash: 'hash',
            sessionString: 'valid_session',
            chats: [{ id: '-10012345', name: 'Test Chat' }],
        };

        const results = [];
        for await (const res of service.run(
            { limit: 50, userId: 'u1', chatId: '-10012345' },
            mockContext,
            mockFactory,
            mockConfigService,
            cfg,
        )) {
            results.push(res);
        }

        expect(mockClient.getMessages).toHaveBeenCalledWith(
            { id: 12345 },
            expect.objectContaining({ minId: 500, limit: 50 }),
        );
        expect(mockContext.storeEnvelopes).toHaveBeenCalledTimes(1);
        expect(mockContext.saveCursor).toHaveBeenCalledWith('telegram', 'u1', '-10012345', 502);
    });

    it('should complete with 0 stored envelopes when no new messages exist after cursor', async () => {
        mockContext.getCursor.mockResolvedValue(500);
        mockClient.getMessages.mockResolvedValue([]);

        const cfg = {
            apiId: 123,
            apiHash: 'hash',
            sessionString: 'valid_session',
            chats: [{ id: '-10012345', name: 'Test Chat' }],
        };

        const results = [];
        for await (const res of service.run(
            { limit: 50, userId: 'u1', chatId: '-10012345' },
            mockContext,
            mockFactory,
            mockConfigService,
            cfg,
        )) {
            results.push(res);
        }

        expect(mockClient.getMessages).toHaveBeenCalledWith(
            { id: 12345 },
            expect.objectContaining({ minId: 500 }),
        );
        expect(mockContext.storeEnvelopes).not.toHaveBeenCalled();
        expect(mockContext.saveCursor).not.toHaveBeenCalled();
    });
});
