/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
    let controller: ProfileController;
    let service: jest.Mocked<ProfileService>;

    const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        providerType: 'EMAIL' as const,
        tokenVersion: 0,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProfileController],
            providers: [
                {
                    provide: ProfileService,
                    useValue: {
                        getMetaData: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get(ProfileController);
        service = module.get(ProfileService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getMetaData', () => {
        it('returns profile meta data for the authenticated user', async () => {
            service.getMetaData.mockResolvedValue(mockUser);

            const result = await controller.getMetaData({
                user: { id: 'user-1' },
            });

            expect(result).toEqual({
                id: 'user-1',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            });
        });

        it('calls service with the correct user ID', async () => {
            service.getMetaData.mockResolvedValue(mockUser);

            await controller.getMetaData({ user: { id: 'user-1' } });

            expect(service.getMetaData).toHaveBeenCalledWith('user-1');
        });

        it('strips extra fields from the response', async () => {
            service.getMetaData.mockResolvedValue(mockUser);

            const result = await controller.getMetaData({
                user: { id: 'user-1' },
            });

            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('providerType');
            expect(result).not.toHaveProperty('tokenVersion');
            expect(result).not.toHaveProperty('createdAt');
            expect(result).not.toHaveProperty('updatedAt');
        });
    });
});
