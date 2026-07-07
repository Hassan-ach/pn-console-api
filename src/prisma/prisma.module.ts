import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppDbModule } from './app-db/app-db.module';
import { AppDbService } from './app-db/app-db.service';

@Global()
@Module({
  providers: [PrismaService, AppDbService],
  exports: [PrismaService],
  imports: [AppDbModule],
})
export class PrismaModule {}
