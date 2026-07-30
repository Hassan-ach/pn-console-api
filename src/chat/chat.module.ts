import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { LlmModule } from '../intelligence/llm/llm.module';
import { EmbeddingsModule } from '../intelligence/embeddings/embeddings.module';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatContextService } from './chat-context.service';
import { ChatService } from './chat.service';

@Module({
    imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }]),
        AppDbModule,
        RepositoriesModule,
        LlmModule,
        EmbeddingsModule,
        AuthModule,
    ],
    controllers: [ChatController],
    providers: [
        ChatContextService,
        ChatService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
    exports: [ChatContextService, ChatService],
})
export class ChatModule {}
