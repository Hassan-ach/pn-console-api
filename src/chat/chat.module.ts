import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatContextService } from './chat-context.service';

@Module({
    imports: [RepositoriesModule],
    providers: [ChatContextService],
    exports: [ChatContextService],
})
export class ChatModule {}
