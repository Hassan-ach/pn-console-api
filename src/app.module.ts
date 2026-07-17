import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { PluginsModule } from './ingestion/plugins/plugins.module';
import { TelegramPluginModule } from './ingestion/plugins/telegram/telegram-plugin.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AuthModule } from './auth/auth.module';
import { DemoModule } from './demo/demo.module';
import { InsightsModule } from './insights/insights.module';
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
        InsightsModule,
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
    ],
})
export class AppModule {}
