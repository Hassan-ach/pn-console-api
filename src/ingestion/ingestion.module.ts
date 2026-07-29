import { Module } from '@nestjs/common';
import { PluginsModule } from './plugins/plugins.module';
import { TelegramPluginModule } from './plugins/providers/telegram/telegram-plugin.module';
import { WorkersModule } from './workers/workers.module';

@Module({
    imports: [PluginsModule, TelegramPluginModule, WorkersModule],
    exports: [PluginsModule, TelegramPluginModule, WorkersModule],
})
export class IngestionModule {}
