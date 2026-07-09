import { Module } from '@nestjs/common';
import { InsightsExtractorModule } from './insights-extractor/insights-extractor.module';
import { MergeModule } from './merge/merge.module';

@Module({
  imports: [InsightsExtractorModule, MergeModule],
})
export class CapabilitiesModule {}
