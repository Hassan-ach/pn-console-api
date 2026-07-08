import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EnvelopeModule } from './envelope/envelope.module';
import { PluginsModule } from './ingestion/plugins/plugins.module';
import { TelegramPluginModule } from './ingestion/plugins/telegram/telegram-plugin.module';
import { AppDbModule } from './prisma/app-db/app-db.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EnvelopeModule,
    PluginsModule,
    TelegramPluginModule,
    AppDbModule,
    IngestionModule,
    IntelligenceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
