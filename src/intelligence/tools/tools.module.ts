import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';

@Module({
    imports: [RepositoriesModule],
    providers: [],
    exports: [],
})
export class ToolsModule {}
