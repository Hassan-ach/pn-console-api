import { Module } from '@nestjs/common';
import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { InsightRepository } from './insight.repository';
import { PlatformUserMappingRepository } from './platform-user-mapping.repository';
import { CapabilityFailureRepository } from './capability-failure.repository';

@Module({
    imports: [AppDbModule, RawDbModule],
    providers: [
        InsightRepository,
        PlatformUserMappingRepository,
        CapabilityFailureRepository,
    ],
    exports: [
        InsightRepository,
        PlatformUserMappingRepository,
        CapabilityFailureRepository,
    ],
})
export class RepositoriesModule {}
