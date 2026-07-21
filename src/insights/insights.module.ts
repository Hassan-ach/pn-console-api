import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
    imports: [AuthModule, RepositoriesModule],
    controllers: [InsightsController],
    providers: [InsightsService],
    exports: [InsightsService],
})
export class InsightsModule {}
