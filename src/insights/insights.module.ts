import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { InsightsController } from './insights.controller';

@Module({
    imports: [AuthModule, RepositoriesModule],
    controllers: [InsightsController],
})
export class InsightsModule {}
