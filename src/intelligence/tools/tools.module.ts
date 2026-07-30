import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { GraphToolsService } from './graph-tools.service';

@Module({
    imports: [RepositoriesModule],
    providers: [GraphToolsService],
    exports: [GraphToolsService],
})
export class ToolsModule {}
