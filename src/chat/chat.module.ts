import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { LlmModule } from '../intelligence/llm/llm.module';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatContextService } from './chat-context.service';
import { ChatService } from './chat.service';

@Module({
    imports: [AppDbModule, RepositoriesModule, LlmModule, AuthModule],
    controllers: [ChatController],
    providers: [ChatContextService, ChatService],
    exports: [ChatContextService, ChatService],
})
export class ChatModule {}
