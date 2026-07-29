import { Test, TestingModule } from '@nestjs/testing';
import { PluginConfigService } from './plugin-config.service';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { ActiveChatListenerRepository } from '../../../repositories/active-chat-listener.repository';
import { EVENT_BUS_TOKEN } from 'src/common/providers/event-bus/event-bus.interface';
import { PluginStatus } from 'generated/app-db-client';

const mockConfigRepo = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    clearSessionString: jest.fn(),
    updateSessionString: jest.fn(),
};

const mockActiveChatRepo = {
    subscribe: jest.fn(),
};

const mockEventBus = {
    publish: jest.fn(),
};

describe('PluginConfigService', () => {
    let service: PluginConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PluginConfigService,
                { provide: PluginConfigRepository, useValue: mockConfigRepo },
                { provide: ActiveChatListenerRepository, useValue: mockActiveChatRepo },
                { provide: EVENT_BUS_TOKEN, useValue: mockEventBus },
            ],
        }).compile();

        service = module.get(PluginConfigService);
        jest.clearAllMocks();
    });

    describe('getConfig', () => {
        it('returns config object when row exists', async () => {
            mockConfigRepo.findUnique.mockResolvedValue({
                config: { apiId: 123, chats: [] },
            });
            const result = await service.getConfig('telegram', 'u1');
            expect(result).toEqual({ apiId: 123, chats: [] });
        });

        it('returns null when no row', async () => {
            mockConfigRepo.findUnique.mockResolvedValue(null);
            const result = await service.getConfig('telegram', 'u1');
            expect(result).toBeNull();
        });
    });

    describe('updateConfig', () => {
        it('upgrades CONNECTED to CONFIGURED when chats exist', async () => {
            mockConfigRepo.update.mockResolvedValue(undefined);
            mockConfigRepo.findUnique
                .mockResolvedValueOnce({ config: { chats: [{ id: 'c1' }] }, status: PluginStatus.CONNECTED });

            await service.updateConfig('telegram', { chats: [{ id: 'c1' }] }, 'u1');

            expect(mockConfigRepo.update).toHaveBeenCalledWith('u1', 'telegram', {
                config: { chats: [{ id: 'c1' }] },
            });
            expect(mockConfigRepo.update).toHaveBeenCalledWith('u1', 'telegram', {
                status: PluginStatus.CONFIGURED,
            });
        });

        it('subscribes chats and emits event when ACTIVE', async () => {
            mockConfigRepo.update.mockResolvedValue(undefined);
            mockConfigRepo.findUnique
                .mockResolvedValueOnce({
                    config: { chats: [{ id: 'c1' }] },
                    status: PluginStatus.ACTIVE,
                    organizationId: 'org-1',
                });

            await service.updateConfig('telegram', { chats: [{ id: 'c1' }] }, 'u1');

            expect(mockActiveChatRepo.subscribe).toHaveBeenCalledWith('telegram', 'c1', 'org-1', 'u1');
            expect(mockEventBus.publish).toHaveBeenCalledWith(
                'plugin.config.updated',
                expect.objectContaining({ pluginName: 'telegram' }),
            );
        });
    });

    describe('disconnect', () => {
        it('clears session and sets CONNECTED status', async () => {
            await service.disconnect('telegram', 'u1');
            expect(mockConfigRepo.clearSessionString).toHaveBeenCalledWith('u1', 'telegram');
            expect(mockConfigRepo.update).toHaveBeenCalledWith('u1', 'telegram', {
                status: PluginStatus.CONNECTED,
            });
        });
    });
});
