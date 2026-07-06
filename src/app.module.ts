import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [InsightsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
