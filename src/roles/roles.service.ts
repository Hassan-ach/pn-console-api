import { Injectable, NotFoundException } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
    constructor(private readonly db: AppDbService) {}

    async create(dto: CreateRoleDto) {
        return this.db.role.create({
            data: {
                name: dto.name,
                description: dto.description ?? null,
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
        return this.db.role.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
        });
    }

    async remove(id: string) {
        const role = await this.db.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundException('Role not found');
        await this.db.role.delete({ where: { id } });
    }
}
