import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramPluginService } from './telegram-plugin.service';
import { TelegramClientFactory } from './telegram-client.factory';
import type { PluginContext } from '../../interfaces/plugin-context.interface';

const mockClient = {
    connect: jest.fn(),
    getMe: jest.fn(),
    destroy: jest.fn(),
    connected: true,
};

const mockFactory = {
    create: jest.fn().mockReturnValue(mockClient),
    destroy: jest.fn(),
} as unknown as jest.Mocked<TelegramClientFactory>;

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

const mockConfig = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

describe('TelegramPluginService', () => {
    let service: TelegramPluginService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TelegramPluginService(mockFactory, mockConfig);
    });

    describe('validateAuth', () => {
        it('throws BadRequestException when no config exists', async () => {
            mockContext.getConfig.mockResolvedValue(null);
            await expect(
                service.validateAuth('sessionStr', mockContext, 'user1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws UnauthorizedException when client.connect fails', async () => {
            mockContext.getConfig.mockResolvedValue({
                apiId: 1,
                apiHash: 'hash',
                sessionString: 'sess',
                chats: [],
            } as never);
            mockClient.connect.mockRejectedValueOnce(new Error('connection refused'));

            await expect(
                service.validateAuth('sessionStr', mockContext, 'user1'),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('returns platform user info on success', async () => {
            mockContext.getConfig.mockResolvedValue({
                apiId: 1,
                apiHash: 'hash',
                sessionString: 'sess',
                chats: [],
            } as never);
            mockClient.connect.mockResolvedValue(undefined);
            mockClient.getMe.mockResolvedValue({ id: 123, username: 'testuser', firstName: 'Test' });

            const result = await service.validateAuth('sessionStr', mockContext, 'user1');
            expect(result.platformUserId).toBe('123');
            expect(result.platformUsername).toBe('testuser');
            expect(mockContext.storeUserMapping).toHaveBeenCalledWith('user1', 'telegram', {
                platformUserId: '123',
                platformUsername: 'testuser',
            });
        });
    });

    describe('isConnected', () => {
        it('returns false when no config', async () => {
            mockContext.getConfig.mockResolvedValue(null);
            await expect(service.isConnected(mockContext, 'user1')).resolves.toBe(false);
        });

        it('returns false when no sessionString', async () => {
            mockContext.getConfig.mockResolvedValue({ apiId: 1, apiHash: 'h', chats: [] } as never);
            await expect(service.isConnected(mockContext, 'user1')).resolves.toBe(false);
        });

        it('returns false when connect errors', async () => {
            mockContext.getConfig.mockResolvedValue({
                apiId: 1, apiHash: 'h', sessionString: 's', chats: [],
            } as never);
            mockClient.connect.mockRejectedValueOnce(new Error('fail'));
            await expect(service.isConnected(mockContext, 'user1')).resolves.toBe(false);
        });

        it('returns client.connected value on success', async () => {
            mockContext.getConfig.mockResolvedValue({
                apiId: 1, apiHash: 'h', sessionString: 's', chats: [],
            } as never);
            mockClient.connect.mockResolvedValue(undefined);
            mockClient.connected = true;
            await expect(service.isConnected(mockContext, 'user1')).resolves.toBe(true);
        });
    });
});
