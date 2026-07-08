import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/raw-db-client';

@Injectable()
export class RawDbService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        await this.$connect();
    }
}
