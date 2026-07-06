import { Module, OnModuleInit } from '@nestjs/common';
import { PluginManagerService } from '../plugin-manager.service';
import { PluginsModule } from '../plugins.module';
import { TelegramPluginService } from './telegram-plugin.service';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramSessionStore } from './telegram-session.store';
import { PendingAuthStore } from './pending-auth.store';

@Module({
  imports: [PluginsModule],
  providers: [
    TelegramClientFactory,
    TelegramAuthService,
    TelegramSessionStore,
    PendingAuthStore,
    TelegramPluginService,
  ],
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
