import { Module, forwardRef } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { IntelligenceModule } from '../../intelligence/intelligence.module';
import { PluginsController } from './plugins.controller';
import { PluginManagerService } from './services/plugin-manager.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginActivationService } from './services/plugin-activation.service';
import { PluginConfigService } from './services/plugin-config.service';
import { WorkersModule } from '../workers/workers.module';

@Module({
    imports: [
        RepositoriesModule,
        RawDbModule,
        IntelligenceModule,
        forwardRef(() => WorkersModule),
    ],
    controllers: [PluginsController],
    providers: [
        PluginConfigService,
        PluginManagerService,
        PluginContextService,
        PluginActivationService,
    ],
    exports: [
        PluginConfigService,
        PluginManagerService,
        PluginContextService,
        PluginActivationService,
    ],
})
export class PluginsModule {}
