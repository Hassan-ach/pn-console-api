import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service';
import { InitializePluginDto } from './dto/initialize-plugin.dto';
import { LoginPluginDto } from './dto/login-plugin.dto';
import { PluginActionDto } from './dto/action-plugin.dto';

@ApiTags('Plugins')
@Controller('plugins')
export class PluginsController {
    constructor(private readonly pluginManager: PluginManagerService) {}

    @Get()
    @ApiOperation({ summary: 'List all registered plugins and their states' })
    list() {
        return this.pluginManager.list();
    }

    @Get(':name')
    @ApiOperation({ summary: 'Get plugin state' })
    getState(@Param('name') name: string) {
        const state = this.pluginManager.getState(name);
        if (!state) throw new Error(`Plugin "${name}" not found`);
        return { name, state };
    }

    @Post(':name/initialize')
    @ApiOperation({ summary: 'Initialize a plugin with config' })
    async initialize(
        @Param('name') name: string,
        @Body() dto: InitializePluginDto,
    ) {
        await this.pluginManager.initPlugin(name, dto.config);
        return { status: 'ok' };
    }

    @Post(':name/login')
    @ApiOperation({ summary: 'Login/authenticate a plugin' })
    async login(@Param('name') name: string, @Body() dto: LoginPluginDto) {
        return this.pluginManager.loginPlugin(name, dto.credentials);
    }

    @Post(':name/action')
    @ApiOperation({ summary: 'Execute a plugin-specific action' })
    async action(@Param('name') name: string, @Body() dto: PluginActionDto) {
        return this.pluginManager.handleAction(name, dto.action, dto.params);
    }

    @Post(':name/logout')
    @ApiOperation({ summary: 'Logout and disconnect a plugin' })
    async logout(@Param('name') name: string) {
        await this.pluginManager.logoutPlugin(name);
        return { status: 'ok' };
    }

    @Delete(':name')
    @ApiOperation({ summary: 'Unregister a plugin' })
    unregister(@Param('name') name: string) {
        this.pluginManager.unregister(name);
        return { status: 'ok' };
    }
}
