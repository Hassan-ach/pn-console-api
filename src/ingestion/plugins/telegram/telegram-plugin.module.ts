import { Module, OnModuleInit } from '@nestjs/common';
import { PluginManagerService } from '../plugin-manager.service';
import { PluginsModule } from '../plugins.module';
import { TelegramPluginService } from './telegram-plugin.service';
import { TelegramClientFactory } from './telegram-client.factory';

@Module({
    imports: [PluginsModule],
    providers: [TelegramClientFactory, TelegramPluginService],
})
export class TelegramPluginModule implements OnModuleInit {
    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly telegramPlugin: TelegramPluginService,
    ) {}

    onModuleInit() {
        this.pluginManager.register(this.telegramPlugin);
    }
}
