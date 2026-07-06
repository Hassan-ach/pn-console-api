import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginManagerService } from './plugin-manager.service';

@Module({
  controllers: [PluginsController],
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginsModule {}
