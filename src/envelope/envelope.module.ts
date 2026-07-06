import { Module } from '@nestjs/common';
import { EnvelopeService } from './envelope.service';

@Module({
    providers: [EnvelopeService],
    exports: [EnvelopeService],
})
export class EnvelopeModule {}
