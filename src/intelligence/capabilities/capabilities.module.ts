import { Module } from '@nestjs/common';
import { InsightsExtractionModule } from './insights-extraction/insights-extraction.module';
import { InsightExtractionCapability } from './insights-extraction/insight-extraction.capability';
import { MergeModule } from '../merge/merge.module';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';

@Module({
    imports: [InsightsExtractionModule, MergeModule],
    providers: [
        CapabilityManager,
        {
            provide: CAPABILITY,
            useFactory: (service: InsightExtractionCapability) => [service],
            inject: [InsightExtractionCapability],
        },
    ],
    exports: [CapabilityManager, MergeModule],
})
export class CapabilitiesModule {}
