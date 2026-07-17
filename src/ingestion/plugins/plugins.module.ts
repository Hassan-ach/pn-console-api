import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { PluginsController } from './plugins.controller';
import { PluginManagerService } from './plugin-manager.service';
import { PluginContextService } from './plugin-context.service';

@Module({
    imports: [RepositoriesModule],
    controllers: [PluginsController],
    providers: [PluginManagerService, PluginContextService],
    exports: [PluginManagerService],
})
export class PluginsModule {}
