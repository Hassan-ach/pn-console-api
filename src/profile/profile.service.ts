import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class ProfileService {
    constructor(private readonly userRepository: UserRepository) {}

    async getMetaData(userId: string) {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }
}
