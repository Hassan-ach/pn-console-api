import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { PluginsController } from './plugins.controller';
import { PluginManagerService } from './services/plugin-manager.service';
import { PluginContextService } from './services/plugin-context.service';

@Module({
    imports: [RepositoriesModule, RawDbModule],
    controllers: [PluginsController],
    providers: [PluginManagerService, PluginContextService],
    exports: [PluginManagerService],
})
export class PluginsModule {}
