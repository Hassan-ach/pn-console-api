import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InsightRepository } from './insight.repository';
import { EnvelopeRepository } from './envelope.repository';
import { OrgStructureRepository } from './org-structure.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { InsightBroadcastLevel } from 'src/types/insight.types';

interface OwnerCreateInput {
    userId: string;
    status: string;
    priority: number | null;
}

interface VersionCreateInput {
    version?: number;
    broadcasted: boolean;
    broadcastLevel: InsightBroadcastLevel | null;
    broadcastTargetId: string | null;
    broadcastTargetName: string | null;
    owners: { create: OwnerCreateInput[] };
}

interface InsightCreateCall {
    data: { versions: { create: VersionCreateInput } };
}

describe('InsightRepository', () => {
    let repository: InsightRepository;
    let mockAppDb: Record<string, Record<string, jest.Mock>>;
    let mockOrgStructure: {
        findTeamByName: jest.Mock;
        findRoleByName: jest.Mock;
    };

    const versionRow = (overrides: Record<string, unknown> = {}) => ({
        id: 'v-1',
        version: 1,
        type: 'TASK',
        content: 'content',
        owners: [{ userId: 'u-1' }],
        unresolvedOwners: [],
        envolopsRef: ['env-1'],
        broadcasted: false,
        broadcastLevel: null,
        broadcastTargetId: null,
        broadcastTargetName: null,
        createdAt: new Date(),
        sourcePlugin: 'telegram',
        groupId: null,
        channelId: null,
        topicId: null,
        deadline: null,
        ...overrides,
    });

    const lastCreateVersion = (): VersionCreateInput => {
        const createMock = mockAppDb.insight.create as unknown as jest.Mock<
            Promise<unknown>,
            [InsightCreateCall]
        >;
        return createMock.mock.calls[0][0].data.versions.create;
    };

    beforeEach(async () => {
        mockAppDb = {
            user: {
                findMany: jest.fn(),
            },
            insight: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
            insightVersion: {
                create: jest.fn(),
                findMany: jest.fn(),
                groupBy: jest.fn(),
                findFirst: jest.fn(),
            },
            insightVersionOwner: {
                createMany: jest.fn(),
            },
            $transaction: jest.fn(),
        };

        mockOrgStructure = {
            findTeamByName: jest.fn(),
            findRoleByName: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightRepository,
                {
                    provide: AppDbService,
                    useValue: mockAppDb,
                },
                {
                    provide: EnvelopeRepository,
                    useValue: {},
                },
                {
                    provide: OrgStructureRepository,
                    useValue: mockOrgStructure,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue(3),
                    },
                },
            ],
        }).compile();

        repository = module.get<InsightRepository>(InsightRepository);
    });

    it('should create a DIRECT insight with explicit owners', async () => {
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [versionRow({ owners: [{ userId: 'u-1' }] })],
        });

        const result = await repository.create({
            organizationId: 'org-1',
            type: 'TASK',
            content: 'content',
            owners: ['u-1'],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.DIRECT,
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.broadcasted).toBe(false);
        expect(versionCreate.broadcastLevel).toBe(InsightBroadcastLevel.DIRECT);
        expect(versionCreate.broadcastTargetId).toBeNull();
        expect(versionCreate.broadcastTargetName).toBeNull();
        expect(versionCreate.owners.create).toEqual([
            { userId: 'u-1', status: 'PENDING', priority: null },
        ]);
        expect(result.broadcastLevel).toBeUndefined();
    });

    it('should create an ORG broadcast without exclusions', async () => {
        mockAppDb.user.findMany.mockResolvedValue([
            { id: 'u-1' },
            { id: 'u-2' },
        ]);
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [
                versionRow({
                    owners: [{ userId: 'u-1' }, { userId: 'u-2' }],
                    broadcasted: true,
                }),
            ],
        });

        await repository.create({
            organizationId: 'org-1',
            type: 'INFO',
            content: 'content',
            owners: [],
            broadcasted: true,
            broadcastLevel: InsightBroadcastLevel.ORG,
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.broadcasted).toBe(true);
        expect(versionCreate.broadcastLevel).toBe(InsightBroadcastLevel.ORG);
        expect(versionCreate.owners.create).toHaveLength(2);
    });

    it('should create an ORG broadcast that excludes users', async () => {
        mockAppDb.user.findMany.mockResolvedValue([
            { id: 'u-1' },
            { id: 'u-2' },
            { id: 'u-3' },
        ]);
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [
                versionRow({ owners: [{ userId: 'u-1' }, { userId: 'u-2' }] }),
            ],
        });

        await repository.create({
            organizationId: 'org-1',
            type: 'INFO',
            content: 'content',
            owners: [],
            broadcasted: true,
            broadcastLevel: InsightBroadcastLevel.ORG,
            excludedUserIds: ['u-3'],
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.broadcasted).toBe(false);
        expect(versionCreate.owners.create.map((o) => o.userId)).toEqual([
            'u-1',
            'u-2',
        ]);
    });

    it('should create a TEAM broadcast targeting the team members', async () => {
        mockOrgStructure.findTeamByName.mockResolvedValue({
            id: 'team-1',
            name: 'Platform',
            memberIds: ['u-1', 'u-2'],
        });
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [
                versionRow({
                    owners: [{ userId: 'u-1' }, { userId: 'u-2' }],
                    broadcastLevel: 'TEAM',
                    broadcastTargetId: 'team-1',
                    broadcastTargetName: 'Platform',
                }),
            ],
        });

        const result = await repository.create({
            organizationId: 'org-1',
            type: 'TASK',
            content: 'content',
            owners: [],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.TEAM,
            broadcastTarget: 'Platform',
        });

        expect(mockOrgStructure.findTeamByName).toHaveBeenCalledWith(
            'org-1',
            'Platform',
        );

        const versionCreate = lastCreateVersion();

        expect(versionCreate.broadcasted).toBe(false);
        expect(versionCreate.broadcastLevel).toBe(InsightBroadcastLevel.TEAM);
        expect(versionCreate.broadcastTargetId).toBe('team-1');
        expect(versionCreate.broadcastTargetName).toBe('Platform');
        expect(versionCreate.owners.create.map((o) => o.userId)).toEqual([
            'u-1',
            'u-2',
        ]);

        expect(result.broadcastTargetName).toBe('Platform');
    });

    it('should create a TEAM broadcast excluding the author', async () => {
        mockOrgStructure.findTeamByName.mockResolvedValue({
            id: 'team-1',
            name: 'Platform',
            memberIds: ['u-1', 'u-2'],
        });
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [versionRow({ owners: [{ userId: 'u-2' }] })],
        });

        await repository.create({
            organizationId: 'org-1',
            type: 'TASK',
            content: 'content',
            owners: [],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.TEAM,
            broadcastTarget: 'Platform',
            excludedUserIds: ['u-1'],
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.owners.create.map((o) => o.userId)).toEqual([
            'u-2',
        ]);
    });

    it('should create a ROLE broadcast targeting the role holders', async () => {
        mockOrgStructure.findRoleByName.mockResolvedValue({
            id: 'role-1',
            name: 'Admin',
            teamId: 'team-1',
            holderIds: ['u-1', 'u-3'],
        });
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [
                versionRow({
                    owners: [{ userId: 'u-1' }, { userId: 'u-3' }],
                    broadcastLevel: 'ROLE',
                    broadcastTargetId: 'role-1',
                    broadcastTargetName: 'Admin',
                }),
            ],
        });

        await repository.create({
            organizationId: 'org-1',
            type: 'URGENCY',
            content: 'content',
            owners: [],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.ROLE,
            broadcastTarget: 'Admin',
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.broadcastLevel).toBe(InsightBroadcastLevel.ROLE);
        expect(versionCreate.broadcastTargetId).toBe('role-1');
        expect(versionCreate.broadcastTargetName).toBe('Admin');
        expect(versionCreate.owners.create.map((o) => o.userId)).toEqual([
            'u-1',
            'u-3',
        ]);
    });

    it('should degrade gracefully when a TEAM target is not resolved', async () => {
        mockOrgStructure.findTeamByName.mockResolvedValue(null);
        mockAppDb.insight.create.mockResolvedValue({
            id: 'ins-1',
            organizationId: 'org-1',
            versions: [versionRow({ owners: [] })],
        });

        const result = await repository.create({
            organizationId: 'org-1',
            type: 'TASK',
            content: 'content',
            owners: [],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.TEAM,
            broadcastTarget: 'Does Not Exist',
        });

        const versionCreate = lastCreateVersion();

        expect(versionCreate.owners.create).toEqual([]);
        expect(versionCreate.broadcastTargetId).toBeNull();
        expect(versionCreate.broadcastTargetName).toBe('Does Not Exist');
        expect(result.broadcasted).toBe(false);
    });

    it('should update an insight with a TEAM broadcast via transaction', async () => {
        const tx = {
            insight: {
                update: jest.fn().mockResolvedValue({}),
                findUnique: jest.fn().mockResolvedValue({
                    id: 'ins-1',
                    organizationId: 'org-1',
                    versions: [
                        versionRow({
                            id: 'v-2',
                            version: 2,
                            owners: [{ userId: 'u-2' }],
                            broadcastLevel: 'TEAM',
                            broadcastTargetId: 'team-1',
                            broadcastTargetName: 'Platform',
                        }),
                    ],
                }),
            },
            insightVersion: {
                groupBy: jest
                    .fn()
                    .mockResolvedValue([{ _max: { version: 1 } }]),
                create: jest.fn().mockResolvedValue({}),
            },
        };

        const transactionMock = mockAppDb.$transaction as unknown as jest.Mock<
            Promise<unknown>,
            [(cb: (tx: typeof tx) => unknown) => unknown]
        >;
        transactionMock.mockImplementation((cb) => cb(tx));
        mockOrgStructure.findTeamByName.mockResolvedValue({
            id: 'team-1',
            name: 'Platform',
            memberIds: ['u-1', 'u-2'],
        });

        const result = await repository.update('ins-1', {
            organizationId: 'org-1',
            type: 'TASK',
            content: 'updated',
            owners: [],
            broadcasted: false,
            broadcastLevel: InsightBroadcastLevel.TEAM,
            broadcastTarget: 'Platform',
        });

        const versionCreateMock = tx.insightVersion
            .create as unknown as jest.Mock<
            Promise<unknown>,
            [{ data: VersionCreateInput }]
        >;
        const data = versionCreateMock.mock.calls[0][0].data;
        expect(data.version).toBe(2);
        expect(data.broadcastLevel).toBe(InsightBroadcastLevel.TEAM);
        expect(data.broadcastTargetId).toBe('team-1');
        expect(data.owners.create.map((o) => o.userId)).toEqual(['u-1', 'u-2']);
        expect(result.broadcastTargetName).toBe('Platform');
    });
});
