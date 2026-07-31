import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { CommonProvidersModule } from 'src/common/providers/common-providers.module';
import { InsightPersistenceService } from './insight-persistence.service';
import { InsightEmbeddingListener } from './insight-embedding.listener';

@Module({
    imports: [RepositoriesModule, EmbeddingsModule, CommonProvidersModule],
    providers: [InsightPersistenceService, InsightEmbeddingListener],
    exports: [InsightPersistenceService, InsightEmbeddingListener],
})
export class StoreModule {}
