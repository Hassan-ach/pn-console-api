import { Module } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { createResolveUsersTool } from './resolve-users.tool';

export const RESOLVE_USERS_TOOL = 'RESOLVE_USERS_TOOL';

@Module({
    imports: [RepositoriesModule],
    providers: [
        {
            provide: RESOLVE_USERS_TOOL,
            useFactory: (
                repo: PlatformUserMappingRepository,
            ): DynamicStructuredTool => createResolveUsersTool(repo),
            inject: [PlatformUserMappingRepository],
        },
    ],
    exports: [RESOLVE_USERS_TOOL],
})
export class ToolsModule {}
