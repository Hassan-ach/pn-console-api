import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InsightModule } from './insight/insight.module';

@Module({
  imports: [InsightModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
