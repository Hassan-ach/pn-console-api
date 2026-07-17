import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service';
import { InitializePluginDto } from './dto/initialize-plugin.dto';
import { LoginPluginDto } from './dto/login-plugin.dto';
import { PluginActionDto } from './dto/action-plugin.dto';

@ApiTags('Plugins')
@Controller('plugins')
export class PluginsController {
    constructor(private readonly pluginManager: PluginManagerService) {}

    @Get()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List registered plugins with status from DB' })
    async list(@Req() req) {
        return this.pluginManager.list(this.userId(req));
    }

    @Get(':name')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get plugin config/status' })
    async getState(@Param('name') name: string, @Req() req) {
        const state = await this.pluginManager.getState(
            name,
            this.userId(req),
        );
        if (!state) throw new Error(`Plugin "${name}" not found`);
        return { name, ...state };
    }

    @Post(':name/initialize')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Store plugin config (replaces init)' })
    async initialize(
        @Param('name') name: string,
        @Body() dto: InitializePluginDto,
        @Req() req,
    ) {
        await this.pluginManager.updateConfig(
            name,
            dto.config,
            this.userId(req),
        );
        return { status: 'ok' };
    }

    @Post(':name/login')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Deprecated — auth moved to frontend' })
    async login(@Param('name') _name: string, @Body() _dto: LoginPluginDto) {
        throw new Error('Login moved to frontend. Use config endpoints.');
    }

    @Post(':name/action')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Deprecated — auth moved to frontend' })
    async action(@Param('name') _name: string, @Body() _dto: PluginActionDto) {
        throw new Error('Action endpoints removed. Auth runs in frontend.');
    }

    @Post(':name/logout')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Clear plugin session/config' })
    async logout(@Param('name') name: string, @Req() req) {
        await this.pluginManager.deleteConfig(name, this.userId(req));
        return { status: 'ok' };
    }

    @Delete(':name')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Unregister a plugin' })
    unregister(@Param('name') name: string) {
        this.pluginManager.unregister(name);
        return { status: 'ok' };
    }

    private userId(req: any): string {
        return (req as any).user?.id ?? 'org-1';
    }
}
