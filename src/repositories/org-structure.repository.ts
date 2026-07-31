import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { InsightBroadcastLevel, Prisma } from 'generated/app-db-client';

export interface TeamRef {
    id: string;
    name: string;
    memberIds: string[];
}

export interface RoleRef {
    id: string;
    name: string;
    teamId: string | null;
    holderIds: string[];
}

@Injectable()
export class OrgStructureRepository {
    constructor(private readonly prisma: AppDbService) {}

    async findTeamsByOrganization(organizationId: string): Promise<TeamRef[]> {
        const teams = await this.prisma.team.findMany({
            where: { organizationId },
            include: {
                members: { select: { userId: true } },
            },
            orderBy: { name: 'asc' },
        });

        return teams.map((t) => ({
            id: t.id,
            name: t.name,
            memberIds: t.members.map((m) => m.userId),
        }));
    }

    async findRolesByOrganization(organizationId: string): Promise<RoleRef[]> {
        const roles = await this.prisma.role.findMany({
            where: { team: { organizationId } },
            include: {
                members: { select: { teamMemberId: true } },
            },
            orderBy: { name: 'asc' },
        });

        const teamMemberRoleRows = await this.prisma.teamMemberRole.findMany({
            where: { teamMember: { team: { organizationId } } },
            select: { roleId: true, teamMember: { select: { userId: true } } },
        });

        const holderMap = new Map<string, string[]>();
        for (const row of teamMemberRoleRows) {
            const list = holderMap.get(row.roleId) ?? [];
            list.push(row.teamMember.userId);
            holderMap.set(row.roleId, list);
        }

        return roles.map((r) => ({
            id: r.id,
            name: r.name,
            teamId: r.teamId,
            holderIds: holderMap.get(r.id) ?? [],
        }));
    }

    async findTeamByName(
        organizationId: string,
        name: string,
    ): Promise<TeamRef | null> {
        const team = await this.prisma.team.findFirst({
            where: {
                organizationId,
                name: { equals: name, mode: 'insensitive' },
            },
            include: {
                members: { select: { userId: true } },
            },
        });

        if (!team) return null;

        return {
            id: team.id,
            name: team.name,
            memberIds: team.members.map((m) => m.userId),
        };
    }

    async findRoleByName(
        organizationId: string,
        name: string,
    ): Promise<RoleRef | null> {
        const role = await this.prisma.role.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                team: { organizationId },
            },
        });

        if (!role) return null;

        const holderIds = await this.findRoleHolderIds(role.id);

        return {
            id: role.id,
            name: role.name,
            teamId: role.teamId,
            holderIds,
        };
    }

    async findRoleHolderIds(roleId: string): Promise<string[]> {
        const rows = await this.prisma.teamMemberRole.findMany({
            where: { roleId },
            select: { teamMember: { select: { userId: true } } },
        });

        return [...new Set(rows.map((r) => r.teamMember.userId))];
    }

    async assignBroadcastInsightsToUser(userId: string): Promise<void> {
        const memberships = await this.prisma.teamMember.findMany({
            where: { userId },
            select: {
                teamId: true,
                roles: { select: { roleId: true } },
            },
        });

        const teamIds = [...new Set(memberships.map((m) => m.teamId))];
        const roleIds = [
            ...new Set(
                memberships.flatMap((m) => m.roles.map((r) => r.roleId)),
            ),
        ];

        if (teamIds.length === 0 && roleIds.length === 0) return;

        const or: Prisma.InsightVersionWhereInput[] = [];
        if (teamIds.length > 0) {
            or.push({
                broadcastLevel: InsightBroadcastLevel.TEAM,
                broadcastTargetId: { in: teamIds },
            });
        }
        if (roleIds.length > 0) {
            or.push({
                broadcastLevel: InsightBroadcastLevel.ROLE,
                broadcastTargetId: { in: roleIds },
            });
        }

        const versions = await this.prisma.insightVersion.findMany({
            where: { OR: or },
            orderBy: { version: 'desc' },
            select: { id: true, insightId: true, version: true },
        });

        const latestByInsight = new Map<string, string>();
        for (const v of versions) {
            const current = latestByInsight.get(v.insightId);
            if (current === undefined) {
                latestByInsight.set(v.insightId, v.id);
            }
        }

        const latestVersionIds = [...latestByInsight.values()];
        if (latestVersionIds.length === 0) return;

        const existing = await this.prisma.insightVersionOwner.findMany({
            where: {
                userId,
                insightVersionId: { in: latestVersionIds },
            },
            select: { insightVersionId: true },
        });

        const existingIds = new Set(existing.map((e) => e.insightVersionId));
        const toCreate = latestVersionIds.filter((id) => !existingIds.has(id));

        if (toCreate.length === 0) return;

        await this.prisma.insightVersionOwner.createMany({
            data: toCreate.map((versionId) => ({
                userId,
                insightVersionId: versionId,
                status: 'PENDING' as const,
            })),
        });
    }
}
