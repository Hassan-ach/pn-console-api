import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EnvelopeModule } from './envelope/envelope.module';
import { PluginsModule } from './plugins/plugins.module';
import { TelegramPluginModule } from './plugins/telegram/telegram-plugin.module';
import { InjectionModule } from './injection/injection.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EnvelopeModule,
    PluginsModule,
    TelegramPluginModule,
    InjectionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
