import { Injectable, NotFoundException } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
    constructor(private readonly db: AppDbService) {}

    async create(dto: CreateRoleDto) {
        const team = await this.db.team.findUnique({
            where: { id: dto.teamId },
        });
        if (!team) throw new NotFoundException('Team not found');

        return this.db.role.create({
            data: {
                name: dto.name,
                description: dto.description ?? null,
                teamId: dto.teamId,
            },
        });
    }

    async findAll() {
        return this.db.role.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: string) {
        const role = await this.db.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundException('Role not found');
        return role;
    }

    async update(id: string, dto: UpdateRoleDto) {
        const role = await this.db.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundException('Role not found');

        if (dto.teamId) {
            const team = await this.db.team.findUnique({
                where: { id: dto.teamId },
            });
            if (!team) throw new NotFoundException('Team not found');
        }

        return this.db.role.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && {
                    description: dto.description,
                }),
                ...(dto.teamId !== undefined && { teamId: dto.teamId }),
            },
        });
    }

    async remove(id: string) {
        const role = await this.db.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundException('Role not found');
        await this.db.role.delete({ where: { id } });
    }
}
