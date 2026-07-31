import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
    imports: [AppDbModule],
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService],
})
export class RolesModule {}
