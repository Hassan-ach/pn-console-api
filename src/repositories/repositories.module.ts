import { Module } from '@nestjs/common';
import { AppDbModule } from 'src/prisma/app-db/app-db.module';
import { InsightRepository } from './insight.repository';

@Module({
  imports: [AppDbModule],
  providers: [InsightRepository],
  exports: [InsightRepository],
})
export class RepositoriesModule {}
