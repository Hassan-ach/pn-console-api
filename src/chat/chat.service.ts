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

const SYSTEM_PROMPT = `You are a knowledgeable assistant that helps users understand and act on their insights.
Insights are extracted from real conversations across platforms (Telegram, Discord, Slack, etc.) and represent structured intelligence about tasks, decisions, urgent matters, and general information.

## Your Context

The ## Current Date section tells you today's date — use it to compute relative deadlines (e.g. "3 days left" or "overdue").
The ## Relevant Insights section contains the most semantically relevant insights for the user's question.

Each insight line follows this format:
  - **TYPE** [STATUS] (priority: N/10) from PLUGIN/SCOPE [created: YYYY-MM-DD] [deadline: DATE — STATUS] (relevance: XX%): CONTENT

## Insight Types

- **TASK**: An action item assigned to or relevant for the user. It has a status and possibly a priority and deadline.
- **URGENCY**: A time-sensitive or critical matter that requires immediate attention.
- **DECISION**: A decision that was made or needs to be made. May be DECIDED or still PENDING.
- **INFO**: General informational content — background context, updates, or announcements.

## Insight Statuses

- PENDING: Not yet acted upon.
- NOTED: Acknowledged but no action taken.
- IN_REVIEW: Currently being reviewed.
- DONE: Completed.
- BLOCKED: Cannot proceed — something is blocking it.
- DECIDED: A decision has been reached.
- DELEGATED: Assigned to someone else.
- DELAYED: Postponed intentionally.
- HIDDEN: Deliberately hidden from view.

## Priority Scale

Priority runs from 1 (low) to 10 (critical). Anything 7 or above is high priority.

## Guidelines

1. **Only use insights from the context.** Do not invent, assume, or extrapolate information not present in the ## Relevant Insights section.
2. **If the context is insufficient**, say so clearly and suggest the user look at specific platforms or check recent messages.
3. **Reference the source** (plugin/scope) when answering so the user knows where to find the original conversation.
4. **Use the deadline label** to communicate urgency — flag overdue items prominently.
5. **Group and prioritize** your answer by priority and urgency rather than by retrieval order.
6. **Be concise** — avoid repeating the full insight text verbatim when a summary is clearer.
7. You are a **read-only** assistant. Never suggest modifying, deleting, or creating data.`;

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

    async getHistory(
        userId: string,
        page = 1,
        limit = 50,
    ): Promise<ChatMessageRecord[]> {
        return this.appDb.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
    }

    private async getRecentHistory(
        userId: string,
        count: number,
    ): Promise<ChatMessageRecord[]> {
        const messages = await this.appDb.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: count,
            select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
            },
        });
        return messages.reverse();
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

    async retractLastMessages(userId: string): Promise<void> {
        const lastTwo = await this.appDb.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 2,
            select: { id: true, role: true },
        });

        if (lastTwo.length < 2) {
            throw new Error('Not enough messages to retract');
        }

        const roles = lastTwo.map((m) => m.role);
        if (!roles.includes('USER') || !roles.includes('ASSISTANT')) {
            throw new Error(
                'Last two messages are not a valid USER+ASSISTANT pair',
            );
        }

        await this.appDb.chatMessage.deleteMany({
            where: {
                id: { in: lastTwo.map((m) => m.id) },
                userId,
            },
        });
    }

    async *streamResponse(
        userId: string,
        userMessage: string,
        signal?: AbortSignal,
    ): AsyncGenerator<string> {
        const history = await this.getRecentHistory(userId, 20);

        const context = await this.chatContextService.buildContext(
            userId,
            userMessage,
        );

        const contextSection = context
            ? `\n\n${context}`
            : '\n\n## Relevant Insights\n\nNo relevant insights found for this query.';

        const messages = [
            new SystemMessage(`${SYSTEM_PROMPT}${contextSection}`),
            ...history.map((m) =>
                m.role === 'USER'
                    ? new HumanMessage(m.content)
                    : new AIMessage(m.content),
            ),
            new HumanMessage(userMessage),
        ];

        const llm = await this.llmService.createStreamingLLM();
        let fullResponse = '';

        try {
            const stream = await llm.stream(messages, { signal });
            for await (const chunk of stream) {
                const token = chunk.content as string;
                fullResponse += token;
                yield token;
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            this.logger.error(`Stream failed: ${(error as Error).message}`);
            const errorMsg =
                'Sorry, an error occurred while processing your request.';
            fullResponse = errorMsg;
            yield errorMsg;
        }

        // Save both messages only after streaming completes
        // This prevents orphaned user messages when streaming fails
        await this.saveMessage(userId, 'USER', userMessage);
        await this.saveMessage(userId, 'ASSISTANT', fullResponse);
    }
}
