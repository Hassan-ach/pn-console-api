import { Module, forwardRef } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { RawDbModule } from 'src/prisma/raw-db/raw-db.module';
import { IntelligenceModule } from 'src/intelligence/intelligence.module';
import { PluginsModule } from '../plugins/plugins.module';
import { WorkerManager } from './worker-manager.service';
import { WorkerRecoveryService } from './worker-recovery.service';

@Module({
    imports: [
        RepositoriesModule,
        RawDbModule,
        IntelligenceModule,
        forwardRef(() => PluginsModule),
    ],
    providers: [WorkerRecoveryService, WorkerManager],
    exports: [WorkerRecoveryService, WorkerManager],
})
export class WorkersModule {}
