import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatContextService } from './chat-context.service';
import { ChatService } from './chat.service';

@Module({
    imports: [AppDbModule, RepositoriesModule],
    providers: [ChatContextService, ChatService],
    exports: [ChatContextService, ChatService],
})
export class ChatModule {}
