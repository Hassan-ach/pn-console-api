import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
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
        description: 'Returns all chat messages ordered by createdAt asc',
    })
    async getHistory(@Req() req: { user: { id: string } }) {
        return this.chatService.getHistory(req.user.id);
    }

    @Post('messages')
    @ApiOperation({ summary: 'Send a message and receive an SSE stream' })
    async sendMessage(
        @Body() dto: SendMessageDto,
        @Req() req: { user: { id: string } },
        @Res() res: Response,
    ) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            for await (const token of this.chatService.streamResponse(
                req.user.id,
                dto.message!,
            )) {
                res.write(
                    `data: ${JSON.stringify({ type: 'token', content: token })}\n\n`,
                );
            }
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        } catch (error) {
            res.write(
                `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
            );
        }

        res.end();
    }
}
