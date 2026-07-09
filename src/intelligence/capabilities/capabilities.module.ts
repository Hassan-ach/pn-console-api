import { Module } from '@nestjs/common';
import { InsightsExtractorModule } from './insights-extractor/insights-extractor.module';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';
import { ICapability } from './capability.interface';

@Module({
    imports: [InsightsExtractorModule],
    providers: [
        CapabilityManager,
        {
            provide: CAPABILITY,
            useValue: [] as ICapability[],
        },
    ],
    exports: [CapabilityManager],
})
export class CapabilitiesModule {}
