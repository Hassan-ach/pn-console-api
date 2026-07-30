import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { GraphToolsService } from './graph-tools.service';
import { SearchToolsService } from './search-tools.service';

@Module({
    imports: [RepositoriesModule, EmbeddingsModule],
    providers: [GraphToolsService, SearchToolsService],
    exports: [GraphToolsService, SearchToolsService],
})
export class ToolsModule {}
