import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/app-db-client';

@Injectable()
export class AppDbService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect();
    }
}
