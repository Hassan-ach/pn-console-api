import { Module } from '@nestjs/common';
import { EnvelopeModule } from '../envelope/envelope.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DemoController } from './demo.controller';

@Module({
    imports: [EnvelopeModule, RepositoriesModule],
    controllers: [DemoController],
})
export class DemoModule {}
