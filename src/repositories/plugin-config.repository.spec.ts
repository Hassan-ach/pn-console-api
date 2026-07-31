import { Test, TestingModule } from '@nestjs/testing';
import { PluginConfigRepository } from './plugin-config.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { CACHE_STORE_TOKEN, ICacheStore } from 'src/common/providers/cache-store/cache-store.interface';
import { PluginStatus } from 'generated/app-db-client';

describe('PluginConfigRepository', () => {
    let repository: PluginConfigRepository;
    let mockAppDb: {
        pluginConfig: {
            findUnique: jest.Mock;
            findMany: jest.Mock;
            upsert: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        $transaction: jest.Mock;
    };
    let mockCacheStore: jest.Mocked<ICacheStore>;

    const sampleRow = {
        id: 'cfg-1',
        organizationId: 'org-1',
        userId: 'user-1',
        pluginName: 'telegram',
        sessionString: 'sess-123',
        config: { chats: [{ id: 'c1' }] },
        metadata: null,
        status: PluginStatus.ACTIVE,
        activatedAt: new Date('2026-07-01'),
        errorMessage: null,
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01'),
    };

    beforeEach(async () => {
        mockAppDb = {
            pluginConfig: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(mockAppDb)),
        };

        mockCacheStore = {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PluginConfigRepository,
                { provide: AppDbService, useValue: mockAppDb },
                { provide: CACHE_STORE_TOKEN, useValue: mockCacheStore },
            ],
        }).compile();

        repository = module.get<PluginConfigRepository>(PluginConfigRepository);
    });

    it('should return cached data on cache hit without querying DB', async () => {
        const cachedData = {
            id: 'cfg-1',
            organizationId: 'org-1',
            userId: 'user-1',
            pluginName: 'telegram',
            sessionString: 'sess-123',
            config: { chats: [{ id: 'c1' }] },
            metadata: null,
            status: PluginStatus.ACTIVE,
            activatedAt: new Date('2026-07-01'),
            errorMessage: null,
            createdAt: new Date('2026-07-01'),
            updatedAt: new Date('2026-07-01'),
        };
        mockCacheStore.get.mockResolvedValue(cachedData);

        const result = await repository.findUnique('user-1', 'telegram');

        expect(mockCacheStore.get).toHaveBeenCalledWith('plugin_config:user-1:telegram');
        expect(mockAppDb.pluginConfig.findUnique).not.toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result?.pluginName).toBe('telegram');
    });

    it('should query DB and populate cache on cache miss', async () => {
        mockCacheStore.get.mockResolvedValue(null);
        mockAppDb.pluginConfig.findUnique.mockResolvedValue(sampleRow);

        const result = await repository.findUnique('user-1', 'telegram');

        expect(mockCacheStore.get).toHaveBeenCalledWith('plugin_config:user-1:telegram');
        expect(mockAppDb.pluginConfig.findUnique).toHaveBeenCalledWith({
            where: { userId_pluginName: { userId: 'user-1', pluginName: 'telegram' } },
        });
        expect(mockCacheStore.set).toHaveBeenCalledWith(
            'plugin_config:user-1:telegram',
            expect.objectContaining({ pluginName: 'telegram' }),
            60000,
        );
        expect(result?.id).toBe('cfg-1');
    });

    it('should invalidate cache when updating config', async () => {
        mockAppDb.pluginConfig.findUnique.mockResolvedValue(sampleRow);
        mockAppDb.pluginConfig.update.mockResolvedValue(sampleRow);

        await repository.update('user-1', 'telegram', { status: PluginStatus.CONFIGURED });

        expect(mockCacheStore.delete).toHaveBeenCalledWith('plugin_config:user-1:telegram');
    });

    it('should invalidate cache when removing config', async () => {
        mockAppDb.pluginConfig.delete.mockResolvedValue(sampleRow);

        await repository.remove('user-1', 'telegram');

        expect(mockCacheStore.delete).toHaveBeenCalledWith('plugin_config:user-1:telegram');
    });
});
