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
import { ActiveChatListenerRepository } from './active-chat-listener.repository';
import { JobRepository } from './job.repository';
import { UserRepository } from './user.repository';
import { EmbeddingRepository } from './embedding.repository';
import { InsightSuggestionRepository } from './insight-suggestion.repository';

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
        ActiveChatListenerRepository,
        JobRepository,
        UserRepository,
        EmbeddingRepository,
        InsightSuggestionRepository,
    ],
    exports: [
        InsightRepository,
        InsightActionRepository,
        PlatformUserMappingRepository,
        CapabilityFailureRepository,
        EnvelopeRepository,
        UnresolvedOwnerRepository,
        PluginConfigRepository,
        ActiveChatListenerRepository,
        JobRepository,
        UserRepository,
        EmbeddingRepository,
        InsightSuggestionRepository,
    ],
})
export class RepositoriesModule {}
