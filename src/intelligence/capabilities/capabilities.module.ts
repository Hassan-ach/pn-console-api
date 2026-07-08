import { Module } from '@nestjs/common';
import { InsightsExtractorModule } from './insights-extractor/insights-extractor.module';

@Module({
  imports: [InsightsExtractorModule],
})
export class CapabilitiesModule {}
