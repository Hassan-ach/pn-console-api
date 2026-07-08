import { Global, Module } from '@nestjs/common';
import { RawDbModule } from './raw-db/raw-db.module';
import { RawDbService } from './raw-db/raw-db.service';
import { AppDbModule } from './app-db/app-db.module';
import { AppDbService } from './app-db/app-db.service';

@Global()
@Module({
    providers: [RawDbService, AppDbService],
    exports: [RawDbService],
    imports: [RawDbModule, AppDbModule],
})
export class PrismaModule {}
