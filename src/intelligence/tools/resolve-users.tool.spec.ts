import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { createResolveUsersTool } from './resolve-users.tool';

describe('resolve_users tool', () => {
    let tool: ReturnType<typeof createResolveUsersTool>;
    let mockRepo: {
        findByPlatformUser: jest.Mock;
        findByPluginName: jest.Mock;
    };

    beforeEach(() => {
        mockRepo = {
            findByPlatformUser: jest.fn(),
            findByPluginName: jest.fn(),
        };
        tool = createResolveUsersTool(
            mockRepo as unknown as PlatformUserMappingRepository,
        );
    });

    it('should have the correct name and description', () => {
        expect(tool.name).toBe('resolve_users');
        expect(tool.description).toBeTruthy();
    });

    describe('resolve by platform user ID', () => {
        it('should return the app user ID when found', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue({
                id: 'mapping-1',
                platformUserId: 'tg_123',
                appUserId: 'app-uuid-1',
                pluginName: 'telegram',
                platformUsername: 'john',
            });

            const result = await tool.invoke({
                users: [{ id: 'tg_123' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1']);
            expect(mockRepo.findByPlatformUser).toHaveBeenCalledWith(
                'tg_123',
                'telegram',
            );
        });

        it('should return null when not found', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue(null);

            const result = await tool.invoke({
                users: [{ id: 'unknown' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual([null]);
        });
    });

    describe('resolve by username (fallback)', () => {
        it('should fall back to username lookup when ID fails', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue(null);
            mockRepo.findByPluginName.mockResolvedValue([
                {
                    id: 'mapping-1',
                    platformUserId: 'tg_456',
                    appUserId: 'app-uuid-1',
                    pluginName: 'telegram',
                    platformUsername: 'john',
                },
            ]);

            const result = await tool.invoke({
                users: [{ username: 'john' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1']);
            expect(mockRepo.findByPlatformUser).not.toHaveBeenCalled();
            expect(mockRepo.findByPluginName).toHaveBeenCalledWith('telegram');
        });

        it('should match case-insensitively', async () => {
            mockRepo.findByPluginName.mockResolvedValue([
                {
                    id: 'mapping-1',
                    platformUserId: 'tg_456',
                    appUserId: 'app-uuid-1',
                    pluginName: 'telegram',
                    platformUsername: 'JohnDoe',
                },
            ]);

            const result = await tool.invoke({
                users: [{ username: 'johndoe' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1']);
        });

        it('should return null when username not found', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue(null);
            mockRepo.findByPluginName.mockResolvedValue([]);

            const result = await tool.invoke({
                users: [{ username: 'nobody' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual([null]);
        });
    });

    describe('ID and username provided together', () => {
        it('should prefer ID and not call username lookup', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue({
                id: 'mapping-1',
                platformUserId: 'tg_1',
                appUserId: 'app-uuid-1',
                pluginName: 'telegram',
                platformUsername: 'jane',
            });

            const result = await tool.invoke({
                users: [{ id: 'tg_1', username: 'jane' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1']);
            expect(mockRepo.findByPlatformUser).toHaveBeenCalledWith(
                'tg_1',
                'telegram',
            );
            expect(mockRepo.findByPluginName).not.toHaveBeenCalled();
        });

        it('should fall back to username when ID fails', async () => {
            mockRepo.findByPlatformUser.mockResolvedValue(null);
            mockRepo.findByPluginName.mockResolvedValue([
                {
                    id: 'mapping-2',
                    platformUserId: 'tg_2',
                    appUserId: 'app-uuid-2',
                    pluginName: 'telegram',
                    platformUsername: 'jane',
                },
            ]);

            const result = await tool.invoke({
                users: [{ id: 'bad', username: 'jane' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-2']);
        });
    });

    describe('multiple users in one call', () => {
        it('should resolve each user independently', async () => {
            mockRepo.findByPlatformUser
                .mockResolvedValueOnce({
                    id: 'mapping-1',
                    platformUserId: 'tg_1',
                    appUserId: 'app-uuid-1',
                    pluginName: 'telegram',
                    platformUsername: 'alice',
                })
                .mockResolvedValueOnce({
                    id: 'mapping-2',
                    platformUserId: 'tg_2',
                    appUserId: 'app-uuid-2',
                    pluginName: 'telegram',
                    platformUsername: 'bob',
                });

            const result = await tool.invoke({
                users: [{ id: 'tg_1' }, { id: 'tg_2' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1', 'app-uuid-2']);
        });

        it('should handle mixed results (some found, some not)', async () => {
            mockRepo.findByPlatformUser
                .mockResolvedValueOnce({
                    id: 'mapping-1',
                    platformUserId: 'tg_1',
                    appUserId: 'app-uuid-1',
                    pluginName: 'telegram',
                    platformUsername: 'alice',
                })
                .mockResolvedValueOnce(null);
            mockRepo.findByPluginName.mockResolvedValue([]);

            const result = await tool.invoke({
                users: [{ id: 'tg_1' }, { id: 'unknown' }],
                pluginName: 'telegram',
            });

            expect(JSON.parse(result)).toEqual(['app-uuid-1', null]);
        });
    });
});
