import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { ProviderType } from 'generated/app-db-client';

export interface UserRecord {
    id: string;
    organizationId: string | null;
    firstName: string;
    lastName: string | null;
    email: string;
    passwordHash: string | null;
    providerType: ProviderType;
    tokenVersion: number;
    role: string;
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

    async findByOrganization(organizationId: string): Promise<UserRecord[]> {
        return this.appDb.user.findMany({
            where: { organizationId },
        });
    }
}
