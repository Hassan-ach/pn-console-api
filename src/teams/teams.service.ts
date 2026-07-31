import { Injectable, NotFoundException } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
    constructor(private readonly db: AppDbService) {}

    async create(dto: CreateTeamDto) {
        return this.db.team.create({
            data: {
                name: dto.name,
                description: dto.description ?? null,
            },
        });
    }

    async findAll() {
        return this.db.team.findMany({
            include: {
                _count: { select: { members: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: string) {
        const team = await this.db.team.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                        roles: {
                            include: { role: true },
                        },
                    },
                },
                _count: { select: { members: true } },
            },
        });
        if (!team) throw new NotFoundException('Team not found');
        return team;
    }

    async update(id: string, dto: UpdateTeamDto) {
        const team = await this.db.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Team not found');
        return this.db.team.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
        });
    }

    async remove(id: string) {
        const team = await this.db.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Team not found');
        await this.db.team.delete({ where: { id } });
    }
}
