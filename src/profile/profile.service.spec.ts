import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UserRepository } from '../repositories/user.repository';

describe('ProfileService', () => {
    let service: ProfileService;
    let repository: jest.Mocked<UserRepository>;

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
            providers: [
                ProfileService,
                {
                    provide: UserRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(ProfileService);
        repository = module.get(UserRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getMetaData', () => {
        it('returns the user when found', async () => {
            repository.findById.mockResolvedValue(mockUser);

            const result = await service.getMetaData('user-1');

            expect(result).toEqual(mockUser);
        });

        it('calls repository with the correct userId', async () => {
            repository.findById.mockResolvedValue(mockUser);

            await service.getMetaData('user-1');

            expect(repository.findById).toHaveBeenCalledWith('user-1');
        });

        it('throws NotFoundException when user not found', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.getMetaData('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
