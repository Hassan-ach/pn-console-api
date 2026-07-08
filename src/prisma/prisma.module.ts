import { Global, Module } from '@nestjs/common';
import { RawDbModule } from './raw-db/raw-db.module';
import { AppDbModule } from './app-db/app-db.module';

@Global()
@Module({
    imports: [RawDbModule, AppDbModule],
    exports: [RawDbModule, AppDbModule],
})
export class PrismaModule {}
