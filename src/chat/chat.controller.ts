import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    ParseIntPipe,
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

    @Get('messages')
    @ApiOperation({ summary: 'Get chat history for the authenticated user' })
    @ApiOkResponse({
        description: 'Returns paginated chat messages ordered by createdAt asc',
    })
    async getHistory(
        @Req() req: Request & { user: { id: string } },
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    ) {
        return this.chatService.getHistory(req.user.id, page, limit);
    }

    @Delete('messages/retract-last')
    @ApiOperation({
        summary: 'Delete the last USER+ASSISTANT message pair (for retry)',
    })
    async retractLast(@Req() req: Request & { user: { id: string } }) {
        return this.chatService.retractLastMessages(req.user.id);
    }

    @Post('message')
    @ApiOperation({ summary: 'Send a message and receive a streaming LLM response' })
    @ApiOkResponse({ description: 'Server-Sent Events (SSE) stream' })
    async sendMessage(
        @Body() dto: SendMessageDto,
        @Req() req: Request & { user: { id: string } },
        @Res() res: Response,
    ) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const abortController = new AbortController();
        let isConnectionClosed = false;

        req.on('close', () => {
            isConnectionClosed = true;
            abortController.abort();
        });

        try {
            for await (const token of this.chatService.streamResponse(
                req.user.id,
                dto.message,
                abortController.signal,
            )) {
                if (isConnectionClosed) break;
                res.write(
                    `data: ${JSON.stringify({ type: 'token', content: token })}\n\n`,
                );
            }
            if (!isConnectionClosed) {
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            }
        } catch (error) {
            if (!isConnectionClosed) {
                res.write(
                    `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
                );
            }
        }

        if (!isConnectionClosed) {
            res.end();
        }
    }
}
