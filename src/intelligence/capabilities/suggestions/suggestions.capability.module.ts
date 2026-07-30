import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { ToolsModule } from '../../tools/tools.module';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { SuggestionsCapability } from './suggestions.capability';

@Module({
    imports: [LlmModule, ToolsModule, RepositoriesModule],
    providers: [SuggestionsCapability],
    exports: [SuggestionsCapability],
})
export class SuggestionsCapabilityModule {}
