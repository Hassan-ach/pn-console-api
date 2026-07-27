import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { LlmModule } from '../intelligence/llm/llm.module';
import { ChatContextService } from './chat-context.service';
import { ChatService } from './chat.service';

@Module({
    imports: [AppDbModule, RepositoriesModule, LlmModule],
    providers: [ChatContextService, ChatService],
    exports: [ChatContextService, ChatService],
})
export class ChatModule {}
