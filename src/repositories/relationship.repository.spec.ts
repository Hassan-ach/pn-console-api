import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipRepository } from './relationship.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

describe('RelationshipRepository', () => {
    let repository: RelationshipRepository;
    let mockAppDb: Record<string, Record<string, jest.Mock>>;

    beforeEach(async () => {
        mockAppDb = {
            entity: {
                findUnique: jest.fn(),
            },
            relationship: {
                create: jest.fn(),
                upsert: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                delete: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RelationshipRepository,
                {
                    provide: AppDbService,
                    useValue: mockAppDb,
                },
            ],
        }).compile();

        repository = module.get<RelationshipRepository>(RelationshipRepository);
    });

    it('should create a relationship', async () => {
        const input = {
            organizationId: 'org-1',
            sourceEntityId: 'ent-1',
            targetEntityId: 'ent-2',
            type: 'OWNS',
        };
        mockAppDb.relationship.create.mockResolvedValue({
            id: 'rel-1',
            ...input,
        });

        const result = await repository.create(input);

        expect(mockAppDb.relationship.create).toHaveBeenCalledWith({
            data: {
                organizationId: 'org-1',
                sourceEntityId: 'ent-1',
                targetEntityId: 'ent-2',
                type: 'OWNS',
                metadata: {},
            },
        });
        expect(result.id).toBe('rel-1');
    });

    it('should upsert relationship', async () => {
        const input = {
            sourceEntityId: 'ent-1',
            targetEntityId: 'ent-2',
            type: 'OWNS',
            metadata: { weight: 1 },
        };
        mockAppDb.relationship.upsert.mockResolvedValue({
            id: 'rel-1',
            ...input,
        });

        const result = await repository.upsert(input);

        expect(mockAppDb.relationship.upsert).toHaveBeenCalledWith({
            where: {
                sourceEntityId_targetEntityId_type: {
                    sourceEntityId: 'ent-1',
                    targetEntityId: 'ent-2',
                    type: 'OWNS',
                },
            },
            create: expect.any(Object) as Record<string, unknown>,
            update: expect.any(Object) as Record<string, unknown>,
        });
        expect(result.id).toBe('rel-1');
    });

    it('should fetch neighbors up to maxDepth', async () => {
        const rootEntity = { id: 'ent-1', name: 'ServiceA', type: 'Service' };
        const neighborEntity = { id: 'ent-2', name: 'TeamA', type: 'Team' };
        const rel = {
            id: 'rel-1',
            sourceEntityId: 'ent-2',
            targetEntityId: 'ent-1',
            type: 'OWNS',
            sourceEntity: neighborEntity,
            targetEntity: rootEntity,
        };

        mockAppDb.entity.findUnique.mockResolvedValue(rootEntity);
        mockAppDb.relationship.findMany
            .mockResolvedValueOnce([rel])
            .mockResolvedValueOnce([]);

        const neighborhood = await repository.getNeighbors('ent-1', 2);

        expect(neighborhood).not.toBeNull();
        expect(neighborhood?.rootEntity).toEqual(rootEntity);
        expect(neighborhood?.entities).toHaveLength(2);
        expect(neighborhood?.relationships).toHaveLength(1);
    });
});
