import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    Optional,
} from '@nestjs/common';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { ChatRole } from 'generated/app-db-client';
import {
    SystemMessage,
    HumanMessage,
    AIMessage,
    AIMessageChunk,
    ToolMessage,
    BaseMessage,
} from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { LlmService } from '../intelligence/llm/llm.service';
import { ChatContextService } from './chat-context.service';
import { SearchToolsService } from '../intelligence/tools/search-tools.service';
import { GraphToolsService } from '../intelligence/tools/graph-tools.service';
import { SYSTEM_PROMPT } from './chat.prompt';

import { ConfigService } from '@nestjs/config';

const CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000;
const TITLE_MAX_LENGTH = 80;

export interface ChatMessageRecord {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: Date;
}

export interface ConversationRecord {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    lastMessage: string | null;
    lastMessageAt: Date | null;
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly appDb: AppDbService,
        private readonly llmService: LlmService,
        private readonly chatContextService: ChatContextService,
        private readonly searchToolsService: SearchToolsService,
        private readonly graphToolsService: GraphToolsService,
        @Optional() private readonly config?: ConfigService,
    ) {}

    async getConversations(
        userId: string,
        page = 1,
        limit = 50,
    ): Promise<ConversationRecord[]> {
        const conversations = await this.appDb.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        content: true,
                        createdAt: true,
                    },
                },
                _count: {
                    select: { messages: true },
                },
            },
        });

        return conversations.map((c) => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            messageCount: c._count.messages,
            lastMessage: c.messages[0]?.content?.slice(0, 120) ?? null,
            lastMessageAt: c.messages[0]?.createdAt ?? null,
        }));
    }

    async createConversation(userId: string): Promise<ConversationRecord> {
        const conversation = await this.appDb.conversation.create({
            data: { userId },
        });
        return {
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            messageCount: 0,
            lastMessage: null,
            lastMessageAt: null,
        };
    }

    async resolveConversation(
        userId: string,
        conversationId?: string | null,
    ): Promise<string> {
        if (conversationId) {
            const existing = await this.appDb.conversation.findUnique({
                where: { id: conversationId },
            });
            if (existing && existing.userId === userId) return existing.id;
        }

        const latest = await this.appDb.conversation.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { id: true, createdAt: true },
                },
            },
        });

        if (latest) {
            if (
                latest.messages[0] &&
                Date.now() - latest.messages[0].createdAt.getTime() <
                    CONVERSATION_TIMEOUT_MS
            ) {
                return latest.id;
            }
            if (latest.messages.length === 0) {
                return latest.id;
            }
        }

        const created = await this.appDb.conversation.create({
            data: { userId },
        });
        return created.id;
    }

    async getHistory(
        userId: string,
        conversationId?: string,
        page = 1,
        limit = 50,
    ): Promise<ChatMessageRecord[]> {
        const targetId =
            conversationId ??
            (
                await this.appDb.conversation.findFirst({
                    where: { userId },
                    orderBy: { updatedAt: 'desc' },
                    select: { id: true },
                })
            )?.id;

        if (!targetId) return [];

        return this.appDb.chatMessage.findMany({
            where: { userId, conversationId: targetId },
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
        conversationId: string,
        count: number,
    ): Promise<ChatMessageRecord[]> {
        const messages = await this.appDb.chatMessage.findMany({
            where: { userId, conversationId },
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

    async deleteConversation(
        userId: string,
        conversationId: string,
    ): Promise<void> {
        const conversation = await this.appDb.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation || conversation.userId !== userId) {
            throw new NotFoundException('Conversation not found');
        }
        await this.appDb.conversation.delete({
            where: { id: conversationId },
        });
    }

    async retractLastMessages(
        userId: string,
        conversationId?: string,
    ): Promise<void> {
        const targetId =
            conversationId ??
            (
                await this.appDb.conversation.findFirst({
                    where: { userId },
                    orderBy: { updatedAt: 'desc' },
                    select: { id: true },
                })
            )?.id;

        if (!targetId) {
            throw new BadRequestException('Not enough messages to retract');
        }

        const lastTwo = await this.appDb.chatMessage.findMany({
            where: { userId, conversationId: targetId },
            orderBy: { createdAt: 'desc' },
            take: 2,
            select: { id: true, role: true },
        });

        if (lastTwo.length < 2) {
            throw new BadRequestException('Not enough messages to retract');
        }

        // Newest must be ASSISTANT, second-newest must be USER
        const [newest, secondNewest] = lastTwo;
        if (newest.role !== 'ASSISTANT' || secondNewest.role !== 'USER') {
            throw new BadRequestException(
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
        conversationId: string,
        userMessage: string,
        signal?: AbortSignal,
    ): AsyncGenerator<string> {
        const history = await this.getRecentHistory(userId, conversationId, 20);
        const context = await this.chatContextService.buildContext(
            userId,
            userMessage,
        );
        const contextSection = context
            ? `\n\n${context}`
            : '\n\n## Relevant Insights\n\nNo relevant insights found for this query.';

        const messages: BaseMessage[] = [
            new SystemMessage(`${SYSTEM_PROMPT}${contextSection}`),
            ...history.map((m) =>
                m.role === 'USER'
                    ? new HumanMessage(m.content)
                    : new AIMessage(m.content),
            ),
            new HumanMessage(userMessage),
        ];

        const orgId = 'org-1';
        const tools: StructuredTool[] = [
            ...this.searchToolsService.getTools(orgId, userId),
            ...this.graphToolsService
                .getTools(orgId)
                .filter((t) =>
                    ['search_graph', 'get_entity', 'get_neighbors'].includes(
                        t.name,
                    ),
                ),
        ];
        const toolMap = new Map(tools.map((t) => [t.name, t]));

        const rawLlm = await this.llmService.createStreamingLLM();
        const llm = rawLlm.bindTools ? rawLlm.bindTools(tools) : rawLlm;
        const maxIterations =
            this.config?.get<number>('chat.maxIterations') ?? 10;

        let fullResponse = '';
        let lastSignature = '';

        try {
            for (let iter = 0; iter < maxIterations; iter++) {
                // Buffer the whole turn before deciding anything.
                let turnText = '';
                let finalChunk: AIMessageChunk | null = null;
                for await (const chunk of await llm.stream(messages, {
                    signal,
                })) {
                    turnText += this.chunkText(chunk);
                    finalChunk = finalChunk
                        ? (finalChunk as any).concat(chunk)
                        : chunk;
                }

                const toolCalls = this.extractToolCalls(finalChunk, turnText);
                const isLastIter = iter === maxIterations - 1;
                const signature = JSON.stringify(
                    toolCalls.map((c) => [c.name, c.args]),
                );
                const isDuplicate =
                    toolCalls.length > 0 && signature === lastSignature;

                if (toolCalls.length === 0 || isLastIter || isDuplicate) {
                    // Nothing to call, or we're forcing an end — stream this text to the user.
                    const finalText =
                        toolCalls.length === 0
                            ? turnText
                            : await this.forceFinalAnswer(
                                  rawLlm,
                                  messages,
                                  signal,
                              );
                    fullResponse = finalText;
                    yield finalText;
                    break;
                }

                lastSignature = signature;
                messages.push(
                    new AIMessage({ content: turnText, tool_calls: toolCalls }),
                );

                for (const call of toolCalls) {
                    const tool = toolMap.get(call.name);
                    let output: string;
                    try {
                        output = tool
                            ? JSON.stringify(await tool.invoke(call.args))
                            : JSON.stringify({
                                  error: `Unknown tool: ${call.name}`,
                              });
                    } catch (err) {
                        output = JSON.stringify({
                            error: (err as Error).message,
                        });
                    }
                    messages.push(
                        new ToolMessage({
                            content: output,
                            tool_call_id: call.id,
                        }),
                    );
                }
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            this.logger.error(`Stream failed: ${(error as Error).message}`);
            fullResponse =
                'Sorry, an error occurred while processing your request.';
            yield fullResponse;
        }

        await this.persistTurn(
            userId,
            conversationId,
            userMessage,
            fullResponse,
        );
    }

    private chunkText(chunk: AIMessageChunk): string {
        if (typeof chunk.content === 'string') return chunk.content;
        if (!Array.isArray(chunk.content)) return '';
        return chunk.content
            .map((item) =>
                typeof item === 'string'
                    ? item
                    : (item as any)?.type === 'text'
                      ? ((item as any).text ?? '')
                      : '',
            )
            .join('');
    }

    private async forceFinalAnswer(
        rawLlm: any,
        messages: BaseMessage[],
        signal?: AbortSignal,
    ) {
        let text = '';
        for await (const chunk of await rawLlm.stream(messages, { signal })) {
            text += this.chunkText(chunk);
        }
        return text;
    }

    private async persistTurn(
        userId: string,
        conversationId: string,
        userMessage: string,
        fullResponse: string,
    ) {
        await this.appDb.$transaction(async (tx) => {
            await tx.chatMessage.create({
                data: {
                    userId,
                    conversationId,
                    role: 'USER',
                    content: userMessage,
                },
            });
            await tx.chatMessage.create({
                data: {
                    userId,
                    conversationId,
                    role: 'ASSISTANT',
                    content: fullResponse,
                },
            });
            const count = await tx.chatMessage.count({
                where: { userId, conversationId },
            });
            if (count === 2) {
                const title =
                    userMessage.length > TITLE_MAX_LENGTH
                        ? userMessage.slice(0, TITLE_MAX_LENGTH) + '\u2026'
                        : userMessage;
                await tx.conversation.update({
                    where: { id: conversationId },
                    data: { title },
                });
            }
        });
    }

    private extractToolCalls(
        chunk: AIMessageChunk | null,
        fullText: string,
    ): Array<{ id: string; name: string; args: Record<string, unknown> }> {
        if (chunk?.tool_calls?.length) {
            return chunk.tool_calls
                .filter((tc) => tc.name)
                .map((tc) => ({
                    id: tc.id?.trim() || `call_${tc.name}_${Date.now()}`,
                    name: String(tc.name),
                    args: (tc.args as Record<string, unknown>) ?? {},
                }));
        }
        if (fullText.includes('DSML') && fullText.includes('tool_calls')) {
            return this.parseDsmlToolCalls(fullText);
        }
        return [];
    }

    private parseDsmlToolCalls(text: string): Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
    }> {
        const results: Array<{
            id: string;
            name: string;
            args: Record<string, unknown>;
        }> = [];

        const blockRegex =
            /<(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*tool_calls>([\s\S]*?)(?:<\/(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*tool_calls>|$)/gi;
        let blockMatch: RegExpExecArray | null;

        while ((blockMatch = blockRegex.exec(text)) !== null) {
            const blockContent = blockMatch[1];
            const invokeRegex =
                /<(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*invoke\s+name=["']([^"']+)["']>([\s\S]*?)(?:<\/(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*invoke>|$)/gi;
            let invokeMatch: RegExpExecArray | null;

            while ((invokeMatch = invokeRegex.exec(blockContent)) !== null) {
                const toolName = invokeMatch[1];
                const invokeContent = invokeMatch[2];

                const paramRegex =
                    /<(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)(?:<\/(?:[|\uFF5C]|\s)*DSML(?:[|\uFF5C]|\s)*parameter>|$)/gi;
                let paramMatch: RegExpExecArray | null;
                const args: Record<string, unknown> = {};

                while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
                    const paramName = paramMatch[1];
                    let paramValue: unknown = paramMatch[2].trim();
                    if (typeof paramValue === 'string') {
                        try {
                            paramValue = JSON.parse(paramValue);
                        } catch {
                            void 0;
                        }
                    }
                    args[paramName] = paramValue;
                }

                results.push({
                    id: `call_${toolName}_${Date.now()}_${Math.random()
                        .toString(36)
                        .substring(2, 7)}`,
                    name: toolName,
                    args,
                });
            }
        }

        return results;
    }
}
