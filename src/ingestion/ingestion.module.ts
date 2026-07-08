import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { EnvelopeModule } from '../envelope/envelope.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
    imports: [PluginsModule, EnvelopeModule],
    controllers: [IngestionController],
    providers: [IngestionService],
})
export class IngestionModule {}
