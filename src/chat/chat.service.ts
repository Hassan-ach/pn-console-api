import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
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
        const searchTools = this.searchToolsService.getTools(orgId, userId);
        const graphTools = this.graphToolsService.getTools(orgId);
        const readOnlyGraphTools = graphTools.filter((t) =>
            ['search_graph', 'get_entity', 'get_neighbors'].includes(t.name),
        );
        const tools: StructuredTool[] = [...searchTools, ...readOnlyGraphTools];
        const toolMap = new Map(tools.map((t) => [t.name, t]));

        const rawLlm = await this.llmService.createStreamingLLM();
        const llm = rawLlm.bindTools ? rawLlm.bindTools(tools) : rawLlm;

        let fullResponse = '';
        const maxIterations = 5;

        try {
            for (let iter = 0; iter < maxIterations; iter++) {
                const stream = await llm.stream(messages, { signal });
                let fullChunk: AIMessageChunk | null = null;
                let turnContent = '';
                const detectedToolCalls: Array<{
                    id: string;
                    name: string;
                    args: Record<string, unknown>;
                }> = [];
                const bufferedTokens: string[] = [];
                const additionalKwargs: Record<string, unknown> = {};

                for await (const chunk of stream) {
                    let textToken = '';
                    if (typeof chunk.content === 'string') {
                        const trimmed = chunk.content.trim();
                        if (
                            !trimmed.startsWith('[{"type":"functionCall"') &&
                            !trimmed.startsWith('{"type":"functionCall"')
                        ) {
                            textToken = chunk.content;
                        }
                    } else if (Array.isArray(chunk.content)) {
                        for (const item of chunk.content) {
                            if (typeof item === 'string') {
                                textToken += item;
                            } else if (
                                typeof item === 'object' &&
                                item !== null
                            ) {
                                const itemObj = item as Record<string, unknown>;
                                if (
                                    itemObj.type === 'text' &&
                                    typeof itemObj.text === 'string'
                                ) {
                                    textToken += itemObj.text;
                                }
                            }
                        }
                    }

                    if (textToken) {
                        turnContent += textToken;
                        bufferedTokens.push(textToken);
                    }

                    const chunkCalls = this.extractToolCalls(chunk);
                    for (const tc of chunkCalls) {
                        if (
                            !detectedToolCalls.some(
                                (d) =>
                                    d.id === tc.id ||
                                    (d.name === tc.name &&
                                        JSON.stringify(d.args) ===
                                            JSON.stringify(tc.args)),
                            )
                        ) {
                            detectedToolCalls.push(tc);
                        }
                    }

                    if (chunk.additional_kwargs) {
                        for (const [k, v] of Object.entries(
                            chunk.additional_kwargs,
                        )) {
                            if (typeof v === 'string') {
                                additionalKwargs[k] =
                                    ((additionalKwargs[k] as string) ?? '') + v;
                            } else {
                                additionalKwargs[k] = v;
                            }
                        }
                    }

                    if (chunk.response_metadata) {
                        const meta = chunk.response_metadata as Record<
                            string,
                            unknown
                        >;
                        if (
                            meta.reasoning_content &&
                            typeof meta.reasoning_content === 'string'
                        ) {
                            additionalKwargs.reasoning_content =
                                ((additionalKwargs.reasoning_content as string) ??
                                    '') + meta.reasoning_content;
                        }
                        if (
                            meta.reasoning &&
                            typeof meta.reasoning === 'string'
                        ) {
                            additionalKwargs.reasoning_content =
                                ((additionalKwargs.reasoning_content as string) ??
                                    '') + meta.reasoning;
                        }
                    }

                    const chunkObj = chunk as unknown as {
                        concat?: (other: AIMessageChunk) => AIMessageChunk;
                    };
                    if (typeof chunkObj.concat === 'function') {
                        fullChunk = fullChunk ? chunkObj.concat(chunk) : chunk;
                    }
                }

                if (fullChunk) {
                    const fullCalls = this.extractToolCalls(fullChunk);
                    for (const tc of fullCalls) {
                        if (
                            !detectedToolCalls.some(
                                (d) =>
                                    d.id === tc.id ||
                                    (d.name === tc.name &&
                                        JSON.stringify(d.args) ===
                                            JSON.stringify(tc.args)),
                            )
                        ) {
                            detectedToolCalls.push(tc);
                        }
                    }
                }

                if (detectedToolCalls.length > 0) {
                    const normalizedToolCalls = detectedToolCalls.map(
                        (tc, idx) => ({
                            name: String(tc.name),
                            args: tc.args ?? {},
                            id:
                                typeof tc.id === 'string' && tc.id.trim() !== ''
                                    ? tc.id
                                    : `call_${idx}_${Date.now()}`,
                            type: 'tool_call' as const,
                        }),
                    );

                    const aiMessageToPush =
                        fullChunk ??
                        new AIMessage({
                            content: turnContent,
                            tool_calls: normalizedToolCalls,
                            additional_kwargs: additionalKwargs,
                        });

                    aiMessageToPush.tool_calls = normalizedToolCalls;

                    if (additionalKwargs.reasoning_content) {
                        aiMessageToPush.additional_kwargs.reasoning_content =
                            additionalKwargs.reasoning_content;
                    }

                    const callSummaries = normalizedToolCalls
                        .map((t) => `${t.name}:${t.id}`)
                        .join(', ');

                    this.logger.debug(
                        `[Chat Tool Call] Iteration ${iter + 1}: Executing ${normalizedToolCalls.length} tool calls (${callSummaries})`,
                    );

                    messages.push(aiMessageToPush);

                    for (const call of normalizedToolCalls) {
                        const tool = toolMap.get(call.name);
                        let toolOutput = '';
                        if (tool) {
                            try {
                                const res: unknown = await tool.invoke(
                                    call.args,
                                );
                                toolOutput =
                                    typeof res === 'string'
                                        ? res
                                        : JSON.stringify(res);
                            } catch (err) {
                                toolOutput = JSON.stringify({
                                    error: (err as Error).message,
                                });
                            }
                        } else {
                            toolOutput = JSON.stringify({
                                error: `Unknown tool: ${call.name}`,
                            });
                        }

                        messages.push(
                            new ToolMessage({
                                content: toolOutput,
                                tool_call_id: call.id,
                            }),
                        );
                    }
                    continue;
                }

                for (const token of bufferedTokens) {
                    fullResponse += token;
                    yield token;
                }
                break;
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            this.logger.error(`Stream failed: ${(error as Error).message}`);
            const errorMsg =
                'Sorry, an error occurred while processing your request.';
            fullResponse = errorMsg;
            yield errorMsg;
        }

        await this.appDb.$transaction(async (tx) => {
            await tx.chatMessage.create({
                data: {
                    userId,
                    conversationId,
                    role: 'USER',
                    content: userMessage,
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
                },
            });
            await tx.chatMessage.create({
                data: {
                    userId,
                    conversationId,
                    role: 'ASSISTANT',
                    content: fullResponse,
                },
                select: {
                    id: true,
                    role: true,
                    content: true,
                    createdAt: true,
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

    private extractToolCalls(chunk: AIMessageChunk): Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
    }> {
        const extracted: Array<{
            id: string;
            name: string;
            args: Record<string, unknown>;
        }> = [];

        if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            for (const tc of chunk.tool_calls) {
                if (tc.name) {
                    extracted.push({
                        id:
                            typeof tc.id === 'string' && tc.id.trim() !== ''
                                ? tc.id
                                : `call_${tc.name}_${Date.now()}`,
                        name: String(tc.name),
                        args: (tc.args as Record<string, unknown>) ?? {},
                    });
                }
            }
        }

        if (chunk.invalid_tool_calls && chunk.invalid_tool_calls.length > 0) {
            for (const tc of chunk.invalid_tool_calls) {
                if (tc.name) {
                    let parsedArgs: Record<string, unknown> = {};
                    if (typeof tc.args === 'string') {
                        try {
                            parsedArgs = JSON.parse(tc.args) as Record<
                                string,
                                unknown
                            >;
                        } catch {}
                    } else if (
                        typeof tc.args === 'object' &&
                        tc.args !== null
                    ) {
                        parsedArgs = tc.args as Record<string, unknown>;
                    }
                    extracted.push({
                        id:
                            typeof tc.id === 'string' && tc.id.trim() !== ''
                                ? tc.id
                                : `call_${tc.name}_${Date.now()}`,
                        name: String(tc.name),
                        args: parsedArgs,
                    });
                }
            }
        }

        if (Array.isArray(chunk.content)) {
            for (const item of chunk.content) {
                if (typeof item === 'object' && item !== null) {
                    const itemObj = item as Record<string, unknown>;
                    if (
                        itemObj.type === 'functionCall' &&
                        itemObj.functionCall
                    ) {
                        const fc = itemObj.functionCall as Record<
                            string,
                            unknown
                        >;
                        const fcName = String(fc.name ?? '');
                        if (fcName) {
                            extracted.push({
                                id: String(
                                    fc.id ??
                                        itemObj.id ??
                                        `call_${fcName}_${Date.now()}`,
                                ),
                                name: fcName,
                                args:
                                    (fc.args as Record<string, unknown>) ?? {},
                            });
                        }
                    } else if (itemObj.type === 'tool_use' && itemObj.name) {
                        const toolName = String(itemObj.name);
                        extracted.push({
                            id: String(
                                itemObj.id ?? `call_${toolName}_${Date.now()}`,
                            ),
                            name: toolName,
                            args: (itemObj.input ??
                                itemObj.args ??
                                {}) as Record<string, unknown>,
                        });
                    }
                }
            }
        }

        const kwargs = chunk.additional_kwargs as
            Record<string, unknown> | undefined;
        if (kwargs?.function_call && typeof kwargs.function_call === 'object') {
            const fc = kwargs.function_call as Record<string, unknown>;
            const fcName = String(fc.name ?? '');
            if (fcName) {
                let parsedArgs: Record<string, unknown> = {};
                if (typeof fc.arguments === 'string') {
                    try {
                        parsedArgs = JSON.parse(fc.arguments) as Record<
                            string,
                            unknown
                        >;
                    } catch {}
                } else if (
                    typeof fc.arguments === 'object' &&
                    fc.arguments !== null
                ) {
                    parsedArgs = fc.arguments as Record<string, unknown>;
                }
                extracted.push({
                    id: `call_${fcName}_${Date.now()}`,
                    name: fcName,
                    args: parsedArgs,
                });
            }
        }

        return extracted;
    }
}
