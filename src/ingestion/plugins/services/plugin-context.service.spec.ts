import { Test, TestingModule } from '@nestjs/testing';
import { PluginContextService } from './plugin-context.service';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { EnvelopeRepository } from '../../../repositories/envelope.repository';
import { PlatformUserMappingRepository } from '../../../repositories/platform-user-mapping.repository';
import { RawDbService } from '../../../prisma/raw-db/raw-db.service';

const mockConfigRepo = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
};

const mockEnvelopeRepo = {
    createManyWithPayload: jest.fn(),
};

const mockMappingRepo = {
    upsert: jest.fn(),
};

const mockRawDb = {
    pluginCursor: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
    },
};

describe('PluginContextService', () => {
    let service: PluginContextService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PluginContextService,
                { provide: PluginConfigRepository, useValue: mockConfigRepo },
                { provide: EnvelopeRepository, useValue: mockEnvelopeRepo },
                {
                    provide: PlatformUserMappingRepository,
                    useValue: mockMappingRepo,
                },
                { provide: RawDbService, useValue: mockRawDb },
            ],
        }).compile();

        service = module.get(PluginContextService);
        jest.clearAllMocks();
    });

    describe('getConfig', () => {
        it('returns config with sessionString when row exists', async () => {
            mockConfigRepo.findUnique.mockResolvedValue({
                config: { apiId: 123 },
                sessionString: 'sess-abc',
            });

            const result = await service.getConfig('u1', 'telegram');
            expect(result).toEqual({
                apiId: 123,
                sessionString: 'sess-abc',
            });
        });

        it('returns null when no row exists', async () => {
            mockConfigRepo.findUnique.mockResolvedValue(null);
            const result = await service.getConfig('u1', 'telegram');
            expect(result).toBeNull();
        });
    });

    describe('saveConfig', () => {
        it('upserts config with resolved orgId', async () => {
            await service.saveConfig('u1', 'telegram', { apiId: 123 });
            expect(mockConfigRepo.upsert).toHaveBeenCalledWith(
                'u1',
                'telegram',
                {
                    organizationId: 'org-1',
                    config: { apiId: 123 },
                    metadata: undefined,
                },
            );
        });
    });

    describe('updateConfig', () => {
        it('delegates to configRepo.update', async () => {
            await service.updateConfig('u1', 'telegram', { apiId: 456 });
            expect(mockConfigRepo.update).toHaveBeenCalledWith(
                'u1',
                'telegram',
                { config: { apiId: 456 } },
            );
        });
    });

    describe('storeUserMapping', () => {
        it('upserts platform user mapping', async () => {
            await service.storeUserMapping('u1', 'telegram', {
                platformUserId: 'p1',
                platformUsername: 'user',
            });
            expect(mockMappingRepo.upsert).toHaveBeenCalledWith({
                appUserId: 'u1',
                pluginName: 'telegram',
                platformUserId: 'p1',
                platformUsername: 'user',
            });
        });
    });

    describe('getCursor', () => {
        it('returns parsed value from DB row', async () => {
            mockRawDb.pluginCursor.findUnique.mockResolvedValue({ value: 42 });
            const result = await service.getCursor('telegram', 'u1', 'chat-1');
            expect(result).toBe(42);
        });

        it('returns null when no cursor row', async () => {
            mockRawDb.pluginCursor.findUnique.mockResolvedValue(null);
            const result = await service.getCursor('telegram', 'u1', 'chat-1');
            expect(result).toBeNull();
        });
    });

    describe('saveCursor', () => {
        it('upserts cursor value', async () => {
            await service.saveCursor('telegram', 'u1', 'chat-1', 42);
            expect(mockRawDb.pluginCursor.upsert).toHaveBeenCalledWith({
                where: {
                    pluginName_userId_key: {
                        pluginName: 'telegram',
                        userId: 'u1',
                        key: 'chat-1',
                    },
                },
                create: {
                    pluginName: 'telegram',
                    userId: 'u1',
                    key: 'chat-1',
                    value: 42,
                },
                update: { value: 42 },
            });
        });
    });

    describe('storeEnvelopes', () => {
        it('maps envelopes and delegates to envelopeRepo', async () => {
            mockEnvelopeRepo.createManyWithPayload.mockResolvedValue({
                inserted: 2,
                ids: ['e1', 'e2'],
            });

            const result = await service.storeEnvelopes(
                [
                    {
                        envelope: {
                            sourcePlugin: 'telegram',
                            sourceId: '123',
                            type: 'message',
                            hasAttachment: false,
                            authorId: 'a1',
                            occurredAt: new Date(),
                        },
                        payload: {
                            content: 'hello',
                            type: 'direct',
                            groupId: null,
                            channelId: null,
                            replyTo: null,
                            topicId: null,
                            reactions: {},
                            pinned: false,
                            editedDate: null,
                            entities: null,
                            rawPayload: {},
                        },
                    },
                    {
                        envelope: {
                            sourcePlugin: 'telegram',
                            sourceId: '456',
                            type: 'message',
                            hasAttachment: true,
                            authorId: 'a2',
                            organizationId: 'custom-org',
                            occurredAt: new Date(),
                        },
                        payload: {
                            content: 'world',
                            type: 'direct',
                            groupId: null,
                            channelId: null,
                            replyTo: null,
                            topicId: null,
                            reactions: {},
                            pinned: false,
                            editedDate: null,
                            entities: null,
                            rawPayload: {},
                        },
                    },
                ],
                'u1',
            );

            expect(result).toEqual({ inserted: 2, ids: ['e1', 'e2'] });
            expect(mockEnvelopeRepo.createManyWithPayload).toHaveBeenCalledWith(
                [
                    {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        envelope: expect.objectContaining({
                            sourcePlugin: 'telegram',
                            sourceId: '123',
                            organizationId: 'org-1',
                        }),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        payload: expect.objectContaining({ content: 'hello' }),
                    },
                    {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        envelope: expect.objectContaining({
                            sourcePlugin: 'telegram',
                            sourceId: '456',
                            organizationId: 'custom-org',
                        }),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        payload: expect.objectContaining({ content: 'world' }),
                    },
                ],
            );
        });
    });

    describe('resolveOrgId', () => {
        it('returns org-1 regardless of input', () => {
            expect(service.resolveOrgId('u1')).toBe('org-1');
            expect(service.resolveOrgId('anything')).toBe('org-1');
        });
    });
});
