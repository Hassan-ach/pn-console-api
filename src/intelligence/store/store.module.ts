import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { InsightPersistenceService } from './insight-persistence.service';

@Module({
    imports: [RepositoriesModule, EmbeddingsModule],
    providers: [InsightPersistenceService],
    exports: [InsightPersistenceService],
})
export class StoreModule {}
