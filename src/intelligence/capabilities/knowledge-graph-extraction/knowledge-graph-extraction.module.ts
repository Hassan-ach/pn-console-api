import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { ToolsModule } from '../../tools/tools.module';
import { KnowledgeGraphExtractionCapability } from './knowledge-graph-extraction.capability';

@Module({
    imports: [LlmModule, ToolsModule],
    providers: [KnowledgeGraphExtractionCapability],
    exports: [KnowledgeGraphExtractionCapability],
})
export class KnowledgeGraphExtractionModule {}
