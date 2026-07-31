import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
    imports: [RepositoriesModule, AppDbModule],
    controllers: [ProfileController],
    providers: [ProfileService],
})
export class ProfileModule {}
