import {
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PluginManagerService } from './services/plugin-manager.service';
import { PluginConfigDto } from './dto/plugin-config.dto';
import { PluginLoginDto } from './dto/plugin-login.dto';

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('plugins')
export class PluginsController {
    constructor(private readonly pluginManager: PluginManagerService) {}

    @Get()
    @ApiOperation({ summary: 'List registered plugins with status from DB' })
    async list(@Req() req: { user: { id: string } }) {
        const data = await this.pluginManager.list(req.user.id);
        return { success: true, message: 'Plugins loaded successfully', data };
    }

    @Get(':name')
    @ApiOperation({ summary: 'Get plugin state (initialized + hasSession)' })
    async getState(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const state = await this.pluginManager.getState(name, req.user.id);
        if (!state) throw new NotFoundException(`Plugin "${name}" not found`);
        return {
            success: true,
            message: `Plugin status loaded`,
            data: { name, ...state },
        };
    }

    @Post(':name/config')
    @ApiOperation({ summary: 'Create or fully replace plugin config' })
    async createConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string; organizationId: string } },
        @Body() body: PluginConfigDto,
    ) {
        await this.pluginManager.createConfig(req.user.id, name, {
            organizationId: req.user.organizationId,
            config: body.config,
        });
        return { success: true, message: 'Configuration saved' };
    }

    @Get(':name/config')
    @ApiOperation({ summary: 'Get plugin config (sessionString masked)' })
    async getConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const config = await this.pluginManager.getSanitizedConfig(
            name,
            req.user.id,
        );
        if (!config)
            throw new NotFoundException(`No config for plugin "${name}"`);
        return { success: true, message: 'Configuration loaded', data: config };
    }

    @Patch(':name/config')
    @ApiOperation({ summary: 'Partially update plugin config' })
    async patchConfig(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
        @Body() body: PluginConfigDto,
    ) {
        await this.pluginManager.updateConfig(name, body.config, req.user.id);
        return { success: true, message: 'Configuration updated' };
    }

    @Post(':name/login')
    @ApiOperation({ summary: 'Authenticate with the plugin platform' })
    async login(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
        @Body() body: PluginLoginDto,
    ) {
        const userInfo = await this.pluginManager.login(
            name,
            req.user.id,
            body.config,
        );
        return {
            success: true,
            message: `Logged in to ${name}`,
            data: userInfo,
        };
    }

    @Post(':name/logout')
    @ApiOperation({ summary: 'Disconnect plugin — clear session' })
    async logout(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        await this.pluginManager.disconnect(name, req.user.id);
        return { success: true, message: 'Disconnected successfully' };
    }

    @Delete(':name')
    @ApiOperation({ summary: 'Unregister a plugin instance' })
    unregister(@Param('name') name: string) {
        this.pluginManager.unregister(name);
        return { success: true, message: 'Plugin removed' };
    }
}
