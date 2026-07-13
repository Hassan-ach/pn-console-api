import { Module } from '@nestjs/common';
import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { InsightRepository } from './insight.repository';
import { PlatformUserMappingRepository } from './platform-user-mapping.repository';

@Module({
    imports: [AppDbModule],
    providers: [InsightRepository, PlatformUserMappingRepository],
    exports: [InsightRepository, PlatformUserMappingRepository],
})
export class RepositoriesModule {}
