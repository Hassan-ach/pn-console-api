import { Injectable, Logger } from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { ChatRole } from 'generated/app-db-client';
import {
    SystemMessage,
    HumanMessage,
    AIMessage,
} from '@langchain/core/messages';
import { LlmService } from '../intelligence/llm/llm.service';
import { ChatContextService } from './chat-context.service';

const SYSTEM_PROMPT = `You are a read-only assistant that helps the user understand their data.
You are concise and direct.
Reference insight types (TASK, URGENCY, INFO, DECISION) and statuses when relevant.
Do not modify or delete any data.`;

export interface ChatMessageRecord {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: Date;
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly appDb: AppDbService,
        private readonly llmService: LlmService,
        private readonly chatContextService: ChatContextService,
    ) {}

    async getHistory(userId: string): Promise<ChatMessageRecord[]> {
        return this.appDb.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
    }

    async saveMessage(
        userId: string,
        role: ChatRole,
        content: string,
    ): Promise<ChatMessageRecord> {
        return this.appDb.chatMessage.create({
            data: {
                userId,
                role,
                content,
            },
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
    }

    async *streamResponse(
        userId: string,
        userMessage: string,
    ): AsyncGenerator<string> {
        await this.saveMessage(userId, 'USER', userMessage);

        const context = await this.chatContextService.buildContext(userId);

        const history = await this.getHistory(userId);
        const last20 = history.slice(-20);

        const messages = [
            new SystemMessage(`${SYSTEM_PROMPT}\n\n${context}`),
            ...last20.map((m) =>
                m.role === 'USER'
                    ? new HumanMessage(m.content)
                    : new AIMessage(m.content),
            ),
            new HumanMessage(userMessage),
        ];

        const llm = await this.llmService.createStreamingLLM();
        let fullResponse = '';

        try {
            const stream = await llm.stream(messages);
            for await (const chunk of stream) {
                const token = chunk.content as string;
                fullResponse += token;
                yield token;
            }
        } catch (error) {
            this.logger.error(`Stream failed: ${(error as Error).message}`);
            const errorMsg =
                'Sorry, an error occurred while processing your request.';
            fullResponse = errorMsg;
            yield errorMsg;
        }

        await this.saveMessage(userId, 'ASSISTANT', fullResponse);
    }
}
