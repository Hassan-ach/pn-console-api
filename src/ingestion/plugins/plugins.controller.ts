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
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { PluginManagerService } from './services/plugin-manager.service';
import { PluginActivationService } from './services/plugin-activation.service';
import { PluginConfigDto } from './dto/plugin-config.dto';
import { PluginLoginDto } from './dto/plugin-login.dto';
import { PluginUpdateChatsDto } from './dto/plugin-update-chats.dto';

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('plugins')
export class PluginsController {
    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly pluginActivation: PluginActivationService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'List registered plugins with status from DB' })
    @ApiResponse({
        status: 200,
        description: 'List of registered plugins loaded',
    })
    async list(@Req() req: { user: { id: string } }) {
        const data = await this.pluginManager.list(req.user.id);
        return { success: true, message: 'Plugins loaded successfully', data };
    }

    @Get(':name')
    @ApiOperation({ summary: 'Get plugin state (initialized + hasSession)' })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Plugin state loaded' })
    @ApiResponse({ status: 404, description: 'Plugin not found' })
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
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Configuration saved' })
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
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Configuration loaded' })
    @ApiResponse({ status: 404, description: 'No configuration found' })
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
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Configuration updated' })
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
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Platform login successful' })
    @ApiResponse({ status: 401, description: 'Authentication failed' })
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
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Disconnected successfully' })
    async logout(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        await this.pluginManager.disconnect(name, req.user.id);
        return { success: true, message: 'Disconnected successfully' };
    }

    @Post(':name/activate')
    @ApiOperation({ summary: 'Activate plugin — start backfill + stream' })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Activation started' })
    async activate(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const data = await this.pluginActivation.activate(req.user.id, name);
        return { success: true, message: 'Activation started', data };
    }

    @Post(':name/deactivate')
    @ApiOperation({ summary: 'Deactivate plugin — stop all workers' })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Deactivated' })
    async deactivate(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        await this.pluginActivation.deactivate(req.user.id, name);
        return {
            success: true,
            message: 'Deactivated',
            data: { status: 'CONFIGURED' },
        };
    }

    @Patch(':name/chats')
    @ApiOperation({ summary: 'Update configured chats for a plugin' })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Chats saved' })
    async updateChats(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
        @Body() body: PluginUpdateChatsDto,
    ) {
        await this.pluginManager.updateConfig(
            name,
            { chats: body.chats },
            req.user.id,
        );
        return { success: true, message: 'Chats saved' };
    }

    @Get(':name/config-schema')
    @ApiOperation({
        summary: 'Get plugin config schema for rendering dynamic forms',
    })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Config schema loaded' })
    getConfigSchema(@Param('name') name: string) {
        const schema = this.pluginManager.getConfigSchema(name);
        return { success: true, message: 'Config schema loaded', data: schema };
    }

    @Get(':name/activation-requirements')
    @ApiOperation({
        summary: 'Get activation requirements and whether they are met',
    })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Activation requirements loaded' })
    async getActivationRequirements(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const data = await this.pluginManager.getActivationRequirements(
            name,
            req.user.id,
        );
        return {
            success: true,
            message: 'Activation requirements loaded',
            data,
        };
    }

    @Get(':name/status')
    @ApiOperation({
        summary: 'Get plugin activation status with per-chat worker state',
    })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Plugin status loaded' })
    async getActivationStatus(
        @Param('name') name: string,
        @Req() req: { user: { id: string } },
    ) {
        const data = await this.pluginActivation.getStatus(req.user.id, name);
        return { success: true, message: 'Plugin status loaded', data };
    }

    @Delete(':name')
    @ApiOperation({ summary: 'Unregister a plugin instance' })
    @ApiParam({ name: 'name', description: 'Plugin name (e.g. telegram)' })
    @ApiResponse({ status: 200, description: 'Plugin removed' })
    unregister(@Param('name') name: string) {
        this.pluginManager.unregister(name);
        return { success: true, message: 'Plugin removed' };
    }
}
