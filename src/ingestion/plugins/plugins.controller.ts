import {
    Controller,
    Delete,
    Get,
    GoneException,
    NotFoundException,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service';
import { PluginConfigDto } from './dto/plugin-config.dto';

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('plugins')
export class PluginsController {
    constructor(private readonly pluginManager: PluginManagerService) {}

    @Get()
    @ApiOperation({ summary: 'List registered plugins with status from DB' })
    async list(@Req() req: { user: { id: string } }) {
        return this.pluginManager.list(req.user.id);
    }

    @Get(':name')
    @ApiOperation({ summary: 'Get plugin state (initialized + hasSession)' })
    async getState(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const state = await this.pluginManager.getState(name, req.user.id);
        if (!state) throw new NotFoundException(`Plugin "${name}" not found`);
        return { name, ...state };
    }

    @Post(':name/config')
    @ApiOperation({ summary: 'Create or fully replace plugin config' })
    async createConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
        body: PluginConfigDto,
    ) {
        await this.pluginManager.updateConfig(name, body.config, req.user.id);
        return { status: 'ok' };
    }

    @Get(':name/config')
    @ApiOperation({ summary: 'Get plugin config (sessionString masked)' })
    async getConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const config = await this.pluginManager.getConfig(name, req.user.id);
        if (!config)
            throw new NotFoundException(`No config for plugin "${name}"`);
        const sanitized = { ...config };
        if (typeof sanitized.sessionString === 'string') {
            sanitized.sessionString =
                sanitized.sessionString.slice(0, 8) + '...';
        }
        return sanitized;
    }

    @Patch(':name/config')
    @ApiOperation({ summary: 'Partially update plugin config' })
    async patchConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
        body: PluginConfigDto,
    ) {
        await this.pluginManager.updateConfig(name, body.config, req.user.id);
        return { status: 'ok' };
    }

    @Post(':name/logout')
    @ApiOperation({
        summary: 'Disconnect plugin — clear sessionString from config',
    })
    async logout(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        await this.pluginManager.updateConfig(
            name,
            { sessionString: null },
            req.user.id,
        );
        return { status: 'ok' };
    }

    @Delete(':name')
    @ApiOperation({ summary: 'Unregister a plugin instance' })
    unregister(@Param('name') name: string) {
        this.pluginManager.unregister(name);
        return { status: 'ok' };
    }
}
