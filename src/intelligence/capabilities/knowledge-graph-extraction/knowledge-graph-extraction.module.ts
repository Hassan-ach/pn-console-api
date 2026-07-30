import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { GraphModule } from 'src/graph/graph.module';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction.capability';

@Module({
    imports: [LlmModule, RepositoriesModule, GraphModule],
    providers: [KnowledgeGraphExtractionCapability],
    exports: [KnowledgeGraphExtractionCapability],
})
export class KnowledgeGraphExtractionModule {}
