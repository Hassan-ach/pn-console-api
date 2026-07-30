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
import ingestionConfig from './config/ingestion.config';
import telegramConfig from './config/telegram.config';
import embeddingsConfig from './config/embeddings.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { CommonProvidersModule } from './common/providers/common-providers.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { DemoModule } from './demo/demo.module';
import { InsightsModule } from './insights/insights.module';
import { JobsModule } from './jobs/jobs.module';
import { ProfileModule } from './profile/profile.module';
import { ChatModule } from './chat/chat.module';
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
                ingestionConfig,
                embeddingsConfig,
            ],
        }),
        EventEmitterModule.forRoot({ wildcard: false }),
        CommonProvidersModule,
        PrismaModule,
        IngestionModule,
        IntelligenceModule,
        AuthModule,
        MailModule,
        DemoModule,
        InsightsModule,
        JobsModule,
        ProfileModule,
        ChatModule,
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
