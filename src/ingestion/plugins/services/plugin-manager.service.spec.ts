import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { PluginContextService } from './plugin-context.service';
import type { IPlugin } from '../interfaces/plugin.interface';
import type { StoreResult } from '../interfaces/plugin-context.interface';
import type { PluginContext } from '../interfaces/plugin-context.interface';

async function* asyncGen<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) {
        yield item;
    }
}

const mockContext: jest.Mocked<PluginContext> = {
    getConfig: jest.fn(),
    saveConfig: jest.fn(),
    updateConfig: jest.fn(),
    storeUserMapping: jest.fn(),
    storeEnvelopes: jest.fn(),
    getCursor: jest.fn(),
    saveCursor: jest.fn(),
    resolveOrgId: jest.fn().mockReturnValue('org-1'),
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
};

const mockConfigRepo = {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    clearSessionString: jest.fn().mockResolvedValue(undefined),
    updateSessionString: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
};

describe('PluginManagerService', () => {
    let service: PluginManagerService;
    let mockPlugin: jest.Mocked<IPlugin>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PluginManagerService,
                { provide: PluginConfigRepository, useValue: mockConfigRepo },
                { provide: PluginContextService, useValue: mockContext },
            ],
        }).compile();

        service = module.get(PluginManagerService);

        jest.clearAllMocks();

        mockPlugin = {
            name: 'test-plugin',
            backfill: jest.fn(),
            isConnected: jest.fn(),
            validateAuth: jest.fn(),
            startStream: jest.fn(),
        };
    });

    describe('register', () => {
        it('adds plugin to instances', () => {
            service.register(mockPlugin);
            expect(service.get('test-plugin')).toBe(mockPlugin);
        });

        it('throws ConflictException on duplicate registration', () => {
            service.register(mockPlugin);
            expect(() => service.register(mockPlugin)).toThrow(
                ConflictException,
            );
        });
    });

    describe('getState', () => {
        it('returns null when plugin not registered', async () => {
            const state = await service.getState('unknown', 'u1');
            expect(state).toBeNull();
        });

        it('returns uninitialized state when no config exists', async () => {
            service.register(mockPlugin);
            mockConfigRepo.findUnique.mockResolvedValue(null);
            const state = await service.getState('test-plugin', 'u1');
            expect(state).toEqual({
                initialized: false,
                hasSession: false,
                isConnected: false,
            });
        });

        it('returns connected state when config and session exist', async () => {
            service.register(mockPlugin);
            mockConfigRepo.findUnique.mockResolvedValue({
                config: { apiId: 1 },
                sessionString: 'session-abc',
            } as any);
            mockPlugin.isConnected.mockResolvedValue(true);
            const state = await service.getState('test-plugin', 'u1');
            expect(state).toEqual({
                initialized: true,
                hasSession: true,
                isConnected: true,
            });
        });
    });

    describe('list', () => {
        it('returns all registered plugins with status', async () => {
            service.register(mockPlugin);
            mockConfigRepo.findMany.mockResolvedValue([
                { pluginName: 'test-plugin', config: {}, sessionString: null },
            ] as any);
            mockPlugin.isConnected.mockResolvedValue(false);

            const result = await service.list('u1');
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: 'test-plugin',
                connected: false,
                hasConfig: true,
            });
        });

        it('catches per-plugin errors without crashing', async () => {
            const plugin2: jest.Mocked<IPlugin> = {
                name: 'broken-plugin',
                backfill: jest.fn(),
                isConnected: jest.fn().mockRejectedValue(new Error('boom')),
                validateAuth: jest.fn(),
                startStream: jest.fn(),
            };
            service.register(mockPlugin);
            service.register(plugin2);
            mockConfigRepo.findMany.mockResolvedValue([]);
            mockPlugin.isConnected.mockResolvedValue(false);

            const result = await service.list('u1');
            expect(result).toHaveLength(2);
            expect(
                result.find((p) => p.name === 'broken-plugin')?.connected,
            ).toBe(false);
        });
    });

    describe('backfill', () => {
        it('delegates to plugin and yields results', async () => {
            service.register(mockPlugin);
            mockPlugin.backfill.mockReturnValue(
                asyncGen([{ inserted: 3, ids: ['a', 'b', 'c'] }]),
            );

            const results: StoreResult[] = [];
            for await (const r of service.backfill('test-plugin', {
                limit: 10,
                userId: 'u1',
                chatId: 'test-chat',
            })) {
                results.push(r);
            }
            expect(results).toEqual([{ inserted: 3, ids: ['a', 'b', 'c'] }]);
        });

        it('throws if plugin not found', async () => {
            const gen = service.backfill('unknown', {
                limit: 10,
                userId: 'u1',
                chatId: 'test-chat',
            });
            await expect(async () => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for await (const _ of gen) {
                    /* noop */
                }
            }).rejects.toThrow(NotFoundException);
        });
    });

    describe('login', () => {
        it('validates auth and saves session', async () => {
            service.register(mockPlugin);
            mockPlugin.validateAuth.mockResolvedValue({
                platformUserId: 'p1',
                platformUsername: 'user',
            });

            const result = await service.login('test-plugin', 'u1', {
                apiId: 123,
                apiHash: 'hash',
                sessionString: 'sess',
            });

            expect(result).toEqual({
                platformUserId: 'p1',
                platformUsername: 'user',
            });
            expect(mockConfigRepo.upsert).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
                {
                    organizationId: 'org-1',
                    config: { apiId: 123, apiHash: 'hash' },
                },
            );
            expect(mockConfigRepo.updateSessionString).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
                'sess',
            );
        });

        it('throws if sessionString is missing', async () => {
            service.register(mockPlugin);
            await expect(
                service.login('test-plugin', 'u1', { apiId: 123 }),
            ).rejects.toThrow('sessionString is required');
        });

        it('throws if plugin not registered', async () => {
            await expect(
                service.login('unknown', 'u1', { sessionString: 's' }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('disconnect', () => {
        it('clears session string', async () => {
            service.register(mockPlugin);
            await service.disconnect('test-plugin', 'u1');
            expect(mockConfigRepo.clearSessionString).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
            );
        });

        it('throws if plugin not found', async () => {
            await expect(service.disconnect('unknown', 'u1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('deleteConfig', () => {
        it('removes config from DB', async () => {
            service.register(mockPlugin);
            await service.deleteConfig('test-plugin', 'u1');
            expect(mockConfigRepo.remove).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
            );
        });

        it('throws if plugin not found', async () => {
            await expect(service.deleteConfig('unknown', 'u1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('unregister', () => {
        it('removes from map', () => {
            service.register(mockPlugin);
            service.unregister('test-plugin');
            expect(service.get('test-plugin')).toBeUndefined();
        });

        it('does not throw when plugin not in map', () => {
            expect(() => service.unregister('unknown')).not.toThrow();
        });
    });

    describe('createConfig', () => {
        it('upserts config', async () => {
            await service.createConfig('u1', 'test-plugin', {
                organizationId: 'org-1',
                config: { apiId: 123 },
            });
            expect(mockConfigRepo.upsert).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
                {
                    organizationId: 'org-1',
                    config: { apiId: 123 },
                },
            );
        });
    });

    describe('updateConfig', () => {
        it('calls configRepo.update', async () => {
            service.register(mockPlugin);
            await service.updateConfig('test-plugin', { apiId: 456 }, 'u1');
            expect(mockConfigRepo.update).toHaveBeenCalledWith(
                'u1',
                'test-plugin',
                { config: { apiId: 456 } },
            );
        });

        it('throws if plugin not found', async () => {
            await expect(
                service.updateConfig('unknown', {}, 'u1'),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
