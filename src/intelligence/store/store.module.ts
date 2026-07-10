import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { InsightPersistenceService } from './insight-persistence.service';

@Module({
    imports: [RepositoriesModule],
    providers: [InsightPersistenceService],
    exports: [InsightPersistenceService],
})
export class StoreModule {}
