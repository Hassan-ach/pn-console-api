import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { ProviderType } from 'generated/app-db-client';

export interface UserRecord {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    passwordHash: string | null;
    providerType: ProviderType;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class UserRepository {
    constructor(private readonly appDb: AppDbService) {}

    async findById(id: string): Promise<UserRecord | null> {
        return this.appDb.user.findUnique({
            where: { id },
        });
    }
}
