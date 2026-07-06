import { Module } from '@nestjs/common';
import { PluginsModule } from '../plugins/plugins.module';
import { EnvelopeModule } from '../envelope/envelope.module';
import { InjectionController } from './injection.controller';
import { InjectionService } from './injection.service';

@Module({
  imports: [PluginsModule, EnvelopeModule],
  controllers: [InjectionController],
  providers: [InjectionService],
})
export class InjectionModule {}
