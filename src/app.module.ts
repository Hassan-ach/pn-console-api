import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { PluginsModule } from './ingestion/plugins/plugins.module';
import { TelegramPluginModule } from './ingestion/plugins/telegram/telegram-plugin.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AuthModule } from './auth/auth.module';
import { DemoModule } from './demo/demo.module';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot({ wildcard: false }),
        PrismaModule,
        PluginsModule,
        TelegramPluginModule,
        IngestionModule,
        IntelligenceModule,
        AuthModule,
        DemoModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
