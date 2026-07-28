import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IsString, IsInt, Min } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingOrchestratorService } from './streaming-orchestrator.service';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';

class StartStreamDto {
    @IsString()
    plugin: string;

    @IsString()
    chatId: string;

    @IsString()
    chatName: string;

    @IsInt()
    @Min(1)
    limit: number;
}

class StopStreamDto {
    @IsString()
    plugin: string;

    @IsString()
    chatId: string;
}

@ApiTags('Streaming')
@Controller('streaming')
export class StreamingController {
    constructor(
        private readonly orchestrator: StreamingOrchestratorService,
        private readonly pluginManager: PluginManagerService,
    ) {}

    @Post('start')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start streaming a chat' })
    startStream(
        @Body() dto: StartStreamDto,
        @Req() req: { user: { id: string; organizationId: string } },
    ) {
        this.orchestrator.startStream(
            dto.plugin,
            dto.chatId,
            dto.chatName,
            dto.limit,
            req.user.id,
            'org-1',
        );
        return { status: 'starting' };
    }

    @Post('stop')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Stop streaming a chat' })
    stopStream(
        @Body() dto: StopStreamDto,
        @Req() req: { user: { id: string } },
    ) {
        this.orchestrator.stopStream(dto.plugin, dto.chatId, req.user.id);
        return { status: 'stopping' };
    }

    @Get('status')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get streaming status for all configured chats' })
    async getStatus(@Req() req: { user: { id: string } }) {
        const pluginName = 'telegram';
        const config = (await this.pluginManager.getConfig(
            pluginName,
            req.user.id,
        )) as { chats?: { id: string; name: string }[] } | null;
        const chats = config?.chats ?? [];
        return this.orchestrator.getStatus(pluginName, req.user.id, chats);
    }
}
