import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Get('conversations')
    @ApiOperation({ summary: 'List conversations for the authenticated user' })
    @ApiOkResponse({
        description:
            'Returns paginated conversations ordered by updatedAt desc',
    })
    async getConversations(
        @Req() req: Request & { user: { id: string } },
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    ) {
        return this.chatService.getConversations(req.user.id, page, limit);
    }

    @Post('conversations')
    @ApiOperation({ summary: 'Create a new empty conversation' })
    async createConversation(@Req() req: Request & { user: { id: string } }) {
        return this.chatService.createConversation(req.user.id);
    }

    @Delete('conversations/:id')
    @ApiOperation({ summary: 'Delete a conversation and all its messages' })
    async deleteConversation(
        @Req() req: Request & { user: { id: string } },
        @Param('id') id: string,
    ) {
        await this.chatService.deleteConversation(req.user.id, id);
        return { success: true };
    }

    @Get('messages')
    @ApiOperation({ summary: 'Get chat history for a conversation' })
    @ApiOkResponse({
        description: 'Returns paginated chat messages ordered by createdAt asc',
    })
    async getHistory(
        @Req() req: Request & { user: { id: string } },
        @Query('conversationId', new ParseUUIDPipe({ optional: true }))
        conversationId?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    ) {
        return this.chatService.getHistory(
            req.user.id,
            conversationId,
            page,
            limit,
        );
    }

    @Delete('messages/retract-last')
    @ApiOperation({
        summary: 'Delete the last USER+ASSISTANT message pair (for retry)',
    })
    async retractLast(
        @Req() req: Request & { user: { id: string } },
        @Query('conversationId', new ParseUUIDPipe({ optional: true }))
        conversationId?: string,
    ) {
        return this.chatService.retractLastMessages(
            req.user.id,
            conversationId,
        );
    }

    @Post('messages')
    @ApiOperation({
        summary: 'Send a message and receive a streaming LLM response',
    })
    @ApiOkResponse({ description: 'Server-Sent Events (SSE) stream' })
    async sendMessage(
        @Body() dto: SendMessageDto,
        @Req() req: Request & { user: { id: string } },
        @Res() res: Response,
    ) {
        let isConnectionClosed = false;
        const abortController = new AbortController();

        const safeWrite = (data: string) => {
            if (!isConnectionClosed) {
                try {
                    res.write(data);
                } catch {
                    isConnectionClosed = true;
                }
            }
        };

        const endResponse = () => {
            if (!isConnectionClosed) {
                try {
                    res.end();
                } catch {
                    isConnectionClosed = true;
                }
            }
        };

        try {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const conversationId = await this.chatService.resolveConversation(
                req.user.id,
                dto.conversationId,
            );

            safeWrite(
                `data: ${JSON.stringify({ type: 'metadata', conversationId })}\n\n`,
            );

            req.on('close', () => {
                isConnectionClosed = true;
                abortController.abort();
            });

            const heartbeat = setInterval(() => {
                safeWrite(':keepalive\n\n');
            }, 15_000);

            try {
                for await (const token of this.chatService.streamResponse(
                    req.user.id,
                    conversationId,
                    dto.message,
                    abortController.signal,
                )) {
                    safeWrite(
                        `data: ${JSON.stringify({ type: 'token', content: token })}\n\n`,
                    );
                }
                safeWrite(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            } catch (error) {
                safeWrite(
                    `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
                );
            } finally {
                clearInterval(heartbeat);
            }
        } catch (error) {
            safeWrite(
                `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
            );
        } finally {
            endResponse();
        }
    }
}
