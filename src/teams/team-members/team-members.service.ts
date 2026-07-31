import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { AppDbService } from '../../prisma/app-db/app-db.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class TeamMembersService {
    constructor(private readonly db: AppDbService) {}

    async addMember(teamId: string, dto: AddMemberDto) {
        const team = await this.db.team.findUnique({ where: { id: teamId } });
        if (!team) throw new NotFoundException('Team not found');

        const user = await this.db.user.findUnique({ where: { id: dto.userId } });
        if (!user) throw new NotFoundException('User not found');

        const existing = await this.db.teamMember.findUnique({
            where: { userId_teamId: { userId: dto.userId, teamId } },
        });
        if (existing) throw new ConflictException('User is already a member of this team');

        const roles = await this.db.role.findMany({
            where: { id: { in: dto.roleIds } },
        });
        if (roles.length !== dto.roleIds.length) {
            throw new NotFoundException('One or more roles not found');
        }

        return this.db.teamMember.create({
            data: {
                userId: dto.userId,
                teamId,
                roles: {
                    create: dto.roleIds.map((roleId) => ({ roleId })),
                },
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                roles: { include: { role: true } },
            },
        });
    }

    async updateMember(teamId: string, userId: string, dto: UpdateMemberDto) {
        const member = await this.db.teamMember.findUnique({
            where: { userId_teamId: { userId, teamId } },
        });
        if (!member) throw new NotFoundException('Member not found in this team');

        const roles = await this.db.role.findMany({
            where: { id: { in: dto.roleIds } },
        });
        if (roles.length !== dto.roleIds.length) {
            throw new NotFoundException('One or more roles not found');
        }

        await this.db.teamMemberRole.deleteMany({
            where: { teamMemberId: member.id },
        });

        return this.db.teamMember.update({
            where: { id: member.id },
            data: {
                roles: {
                    create: dto.roleIds.map((roleId) => ({ roleId })),
                },
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                roles: { include: { role: true } },
            },
        });
    }

    async removeMember(teamId: string, userId: string) {
        const member = await this.db.teamMember.findUnique({
            where: { userId_teamId: { userId, teamId } },
        });
        if (!member) throw new NotFoundException('Member not found in this team');
        await this.db.teamMember.delete({ where: { id: member.id } });
    }

    async getUserTeams(userId: string) {
        return this.db.teamMember.findMany({
            where: { userId },
            include: {
                team: true,
                roles: { include: { role: true } },
            },
        });
    }
}
