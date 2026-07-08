import { Module } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

@Module({
  providers: [AppDbService],
  imports: [],
})
export class InsightsModule {}
