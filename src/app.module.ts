import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import llmConfig from './config/llm.config';
import oauthConfig from './config/oauth.config';
import smtpConfig from './config/smtp.config';
import engineConfig from './config/engine.config';
import contextConfig from './config/context.config';
import chunkingConfig from './config/chunking.config';
import telegramConfig from './config/telegram.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { PluginsModule } from './ingestion/plugins/plugins.module';
import { TelegramPluginModule } from './ingestion/plugins/telegram/telegram-plugin.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { DemoModule } from './demo/demo.module';
import { InsightsModule } from './insights/insights.module';
import { JobsModule } from './jobs/jobs.module';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [
                appConfig,
                databaseConfig,
                jwtConfig,
                llmConfig,
                oauthConfig,
                smtpConfig,
                engineConfig,
                contextConfig,
                chunkingConfig,
                telegramConfig,
            ],
        }),
        EventEmitterModule.forRoot({ wildcard: false }),
        PrismaModule,
        PluginsModule,
        TelegramPluginModule,
        IngestionModule,
        IntelligenceModule,
        AuthModule,
        MailModule,
        DemoModule,
        InsightsModule,
        JobsModule,
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
