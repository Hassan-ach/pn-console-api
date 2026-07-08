import { Module } from '@nestjs/common';
import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { InsightPersistenceService } from './insight-persistence.service';

@Module({
  imports: [AppDbModule],
  providers: [InsightPersistenceService],
  exports: [InsightPersistenceService],
})
export class StoreModule {}
