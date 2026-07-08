import { Module } from '@nestjs/common';
import { RawDbService } from './raw-db.service';

@Module({
    providers: [RawDbService],
    exports: [RawDbService],
})
export class RawDbModule {}
