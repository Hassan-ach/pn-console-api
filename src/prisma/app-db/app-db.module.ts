import { Module } from '@nestjs/common';
import { AppDbService } from './app-db.service';

@Module({
  providers: [AppDbService],
  exports: [AppDbService],
})
export class AppDbModule {}
