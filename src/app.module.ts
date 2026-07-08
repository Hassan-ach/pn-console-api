import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EnvelopeModule } from './envelope/envelope.module';
import { PluginsModule } from './ingestion/plugins/plugins.module';
import { TelegramPluginModule } from './ingestion/plugins/telegram/telegram-plugin.module';
import { InsightsModule } from './insights/insights.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        EnvelopeModule,
        PluginsModule,
        TelegramPluginModule,
        IngestionModule,
        InsightsModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
