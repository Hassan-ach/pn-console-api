import { Module } from '@nestjs/common';
import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { InsightRepository } from './insight.repository';
import { InsightActionRepository } from './insight-action.repository';
import { PlatformUserMappingRepository } from './platform-user-mapping.repository';
import { CapabilityFailureRepository } from './capability-failure.repository';
import { EnvelopeRepository } from './envelope.repository';
import { UnresolvedOwnerRepository } from './unresolved-owner.repository';
import { PluginConfigRepository } from './plugin-config.repository';
import { JobRepository } from './job.repository';

@Module({
    imports: [AppDbModule, RawDbModule],
    providers: [
        InsightRepository,
        InsightActionRepository,
        PlatformUserMappingRepository,
        CapabilityFailureRepository,
        EnvelopeRepository,
        UnresolvedOwnerRepository,
        PluginConfigRepository,
        JobRepository,
    ],
    exports: [
        InsightRepository,
        InsightActionRepository,
        PlatformUserMappingRepository,
        CapabilityFailureRepository,
        EnvelopeRepository,
        UnresolvedOwnerRepository,
        PluginConfigRepository,
        JobRepository,
    ],
})
export class RepositoriesModule {}
