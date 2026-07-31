import { Test, TestingModule } from '@nestjs/testing';
import { OrgStructureRepository } from './org-structure.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { InsightBroadcastLevel } from 'generated/app-db-client';

describe('OrgStructureRepository', () => {
    let repository: OrgStructureRepository;
    let mockAppDb: Record<string, Record<string, jest.Mock>>;

    beforeEach(async () => {
        mockAppDb = {
            team: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            role: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            teamMemberRole: {
                findMany: jest.fn(),
            },
            teamMember: {
                findMany: jest.fn(),
            },
            insightVersion: {
                findMany: jest.fn(),
            },
            insightVersionOwner: {
                findMany: jest.fn(),
                createMany: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrgStructureRepository,
                {
                    provide: AppDbService,
                    useValue: mockAppDb,
                },
            ],
        }).compile();

        repository = module.get<OrgStructureRepository>(OrgStructureRepository);
    });

    it('should return teams with member ids', async () => {
        mockAppDb.team.findMany.mockResolvedValue([
            {
                id: 'team-1',
                name: 'Platform',
                members: [{ userId: 'u-1' }, { userId: 'u-2' }],
            },
            {
                id: 'team-2',
                name: 'Core',
                members: [],
            },
        ]);

        const result = await repository.findTeamsByOrganization('org-1');

        expect(mockAppDb.team.findMany).toHaveBeenCalledWith({
            where: { organizationId: 'org-1' },
            include: { members: { select: { userId: true } } },
            orderBy: { name: 'asc' },
        });
        expect(result).toEqual([
            { id: 'team-1', name: 'Platform', memberIds: ['u-1', 'u-2'] },
            { id: 'team-2', name: 'Core', memberIds: [] },
        ]);
    });

    it('should return roles with holder ids resolved from memberships', async () => {
        mockAppDb.role.findMany.mockResolvedValue([
            { id: 'role-1', name: 'Admin', teamId: 'team-1' },
            { id: 'role-2', name: 'Viewer', teamId: 'team-1' },
        ]);
        mockAppDb.teamMemberRole.findMany.mockResolvedValue([
            { roleId: 'role-1', teamMember: { userId: 'u-1' } },
            { roleId: 'role-1', teamMember: { userId: 'u-2' } },
            { roleId: 'role-2', teamMember: { userId: 'u-1' } },
        ]);

        const result = await repository.findRolesByOrganization('org-1');

        expect(result).toEqual([
            {
                id: 'role-1',
                name: 'Admin',
                teamId: 'team-1',
                holderIds: ['u-1', 'u-2'],
            },
            {
                id: 'role-2',
                name: 'Viewer',
                teamId: 'team-1',
                holderIds: ['u-1'],
            },
        ]);
    });

    it('should find a team by name case-insensitively', async () => {
        mockAppDb.team.findFirst.mockResolvedValue({
            id: 'team-1',
            name: 'Platform',
            members: [{ userId: 'u-1' }],
        });

        const result = await repository.findTeamByName('org-1', 'platform');

        expect(mockAppDb.team.findFirst).toHaveBeenCalledWith({
            where: {
                organizationId: 'org-1',
                name: { equals: 'platform', mode: 'insensitive' },
            },
            include: { members: { select: { userId: true } } },
        });
        expect(result).toEqual({
            id: 'team-1',
            name: 'Platform',
            memberIds: ['u-1'],
        });
    });

    it('should return null when team is not found', async () => {
        mockAppDb.team.findFirst.mockResolvedValue(null);

        const result = await repository.findTeamByName('org-1', 'nope');

        expect(result).toBeNull();
    });

    it('should find a role by name within the organization', async () => {
        mockAppDb.role.findFirst.mockResolvedValue({
            id: 'role-1',
            name: 'Admin',
            teamId: 'team-1',
        });
        mockAppDb.teamMemberRole.findMany.mockResolvedValue([
            { teamMember: { userId: 'u-1' } },
            { teamMember: { userId: 'u-1' } },
        ]);

        const result = await repository.findRoleByName('org-1', 'admin');

        expect(mockAppDb.role.findFirst).toHaveBeenCalledWith({
            where: {
                name: { equals: 'admin', mode: 'insensitive' },
                team: { organizationId: 'org-1' },
            },
        });
        expect(result).toEqual({
            id: 'role-1',
            name: 'Admin',
            teamId: 'team-1',
            holderIds: ['u-1'],
        });
    });

    it('should return unique holder ids for a role', async () => {
        mockAppDb.teamMemberRole.findMany.mockResolvedValue([
            { teamMember: { userId: 'u-1' } },
            { teamMember: { userId: 'u-2' } },
            { teamMember: { userId: 'u-1' } },
        ]);

        const result = await repository.findRoleHolderIds('role-1');

        expect(result).toEqual(['u-1', 'u-2']);
    });

    it('should assign matching team and role broadcasts to a user', async () => {
        mockAppDb.teamMember.findMany.mockResolvedValue([
            {
                teamId: 'team-1',
                roles: [{ roleId: 'role-1' }],
            },
        ]);

        mockAppDb.insightVersion.findMany.mockResolvedValue([
            {
                id: 'v-2',
                insightId: 'ins-1',
                version: 2,
            },
            {
                id: 'v-1',
                insightId: 'ins-1',
                version: 1,
            },
            {
                id: 'v-3',
                insightId: 'ins-2',
                version: 1,
            },
        ]);

        mockAppDb.insightVersionOwner.findMany.mockResolvedValue([
            { insightVersionId: 'v-2' },
        ]);

        await repository.assignBroadcastInsightsToUser('u-1');

        expect(mockAppDb.insightVersion.findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    {
                        broadcastLevel: InsightBroadcastLevel.TEAM,
                        broadcastTargetId: { in: ['team-1'] },
                    },
                    {
                        broadcastLevel: InsightBroadcastLevel.ROLE,
                        broadcastTargetId: { in: ['role-1'] },
                    },
                ],
            },
            orderBy: { version: 'desc' },
            select: { id: true, insightId: true, version: true },
        });

        expect(mockAppDb.insightVersionOwner.createMany).toHaveBeenCalledWith({
            data: [
                {
                    userId: 'u-1',
                    insightVersionId: 'v-3',
                    status: 'PENDING',
                },
            ],
        });
    });

    it('should skip assignment when the user has no memberships', async () => {
        mockAppDb.teamMember.findMany.mockResolvedValue([]);

        await repository.assignBroadcastInsightsToUser('u-1');

        expect(mockAppDb.insightVersion.findMany).not.toHaveBeenCalled();
        expect(mockAppDb.insightVersionOwner.createMany).not.toHaveBeenCalled();
    });

    it('should skip assignment when no matching broadcasts exist', async () => {
        mockAppDb.teamMember.findMany.mockResolvedValue([
            { teamId: 'team-1', roles: [] },
        ]);
        mockAppDb.insightVersion.findMany.mockResolvedValue([]);

        await repository.assignBroadcastInsightsToUser('u-1');

        expect(mockAppDb.insightVersionOwner.createMany).not.toHaveBeenCalled();
    });
});
