import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { PluginsController } from './plugins.controller';
import { PluginManagerService } from './services/plugin-manager.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginActivationService } from './services/plugin-activation.service';
import { WorkerManager } from './services/worker-manager.service';

@Module({
    imports: [RepositoriesModule, RawDbModule],
    controllers: [PluginsController],
    providers: [
        PluginManagerService,
        PluginContextService,
        PluginActivationService,
        WorkerManager,
    ],
    exports: [PluginManagerService, PluginActivationService, WorkerManager],
})
export class PluginsModule {}
