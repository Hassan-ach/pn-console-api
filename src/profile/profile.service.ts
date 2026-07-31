import { Injectable, NotFoundException } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class ProfileService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly db: AppDbService,
    ) {}

    async getMetaData(userId: string) {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const teamMemberships = await this.db.teamMember.findMany({
            where: { userId },
            include: {
                team: true,
                roles: { include: { role: true } },
            },
        });

        return {
            ...user,
            teams: teamMemberships.map((m) => ({
                id: m.team.id,
                name: m.team.name,
                roles: m.roles.map((r) => r.role.name),
            })),
        };
    }
}
