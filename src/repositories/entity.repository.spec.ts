import { Test, TestingModule } from '@nestjs/testing';
import { EntityRepository } from './entity.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

describe('EntityRepository', () => {
    let repository: EntityRepository;
    let mockAppDb: any;

    beforeEach(async () => {
        mockAppDb = {
            entity: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EntityRepository,
                { provide: AppDbService, useValue: mockAppDb },
            ],
        }).compile();

        repository = module.get<EntityRepository>(EntityRepository);
    });

    it('should create an entity', async () => {
        const input = {
            organizationId: 'org-1',
            name: 'pn-console-api',
            type: 'Service',
            metadata: { owner: 'backend' },
        };
        const expected = { id: 'ent-1', ...input, createdAt: new Date(), updatedAt: new Date() };
        mockAppDb.entity.create.mockResolvedValue(expected);

        const result = await repository.create(input);

        expect(mockAppDb.entity.create).toHaveBeenCalledWith({
            data: {
                organizationId: 'org-1',
                name: 'pn-console-api',
                type: 'Service',
                metadata: { owner: 'backend' },
            },
        });
        expect(result).toEqual(expected);
    });

    it('should upsert entity by creating if not existing', async () => {
        mockAppDb.entity.findFirst.mockResolvedValue(null);
        const expected = { id: 'ent-1', name: 'pn-console-api', type: 'Service' };
        mockAppDb.entity.create.mockResolvedValue(expected);

        const result = await repository.upsert({
            name: 'pn-console-api ',
            type: ' Service ',
        });

        expect(mockAppDb.entity.findFirst).toHaveBeenCalledWith({
            where: {
                organizationId: null,
                name: { equals: 'pn-console-api', mode: 'insensitive' },
                type: { equals: 'Service', mode: 'insensitive' },
            },
        });
        expect(mockAppDb.entity.create).toHaveBeenCalled();
        expect(result).toEqual(expected);
    });

    it('should upsert entity by updating metadata if existing', async () => {
        const existing = {
            id: 'ent-1',
            name: 'pn-console-api',
            type: 'Service',
            metadata: { version: '1.0' },
        };
        mockAppDb.entity.findFirst.mockResolvedValue(existing);
        mockAppDb.entity.update.mockResolvedValue({
            ...existing,
            metadata: { version: '1.0', owner: 'team-a' },
        });

        const result = await repository.upsert({
            name: 'pn-console-api',
            type: 'Service',
            metadata: { owner: 'team-a' },
        });

        expect(mockAppDb.entity.update).toHaveBeenCalledWith({
            where: { id: 'ent-1' },
            data: { metadata: { version: '1.0', owner: 'team-a' } },
        });
        expect(result.metadata).toEqual({ version: '1.0', owner: 'team-a' });
    });

    it('should search entities by query', async () => {
        mockAppDb.entity.findMany.mockResolvedValue([
            { id: 'ent-1', name: 'pn-console-api', type: 'Service' },
        ]);

        const results = await repository.search('org-1', 'console', 'Service', 10);

        expect(mockAppDb.entity.findMany).toHaveBeenCalledWith({
            where: {
                organizationId: 'org-1',
                type: { equals: 'Service', mode: 'insensitive' },
                name: { contains: 'console', mode: 'insensitive' },
            },
            take: 10,
            orderBy: { name: 'asc' },
        });
        expect(results).toHaveLength(1);
    });
});
