import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntelligenceEngineService } from '../intelligence/intelligence-engine.service';
import { RunIntelligenceDto } from './dto/run-intelligence.dto';

@ApiTags('Demo')
@Controller('demo/intelligence')
export class DemoIntelligenceController {
    constructor(
        private readonly engine: IntelligenceEngineService,
    ) {}

    @Post('run')
    @ApiOperation({ summary: 'Demo: run the full intelligence engine pipeline' })
    async run(@Body() dto: RunIntelligenceDto) {
        const result = await this.engine.run('org-1', {
            envelopeIds: dto.envelopeIds,
            windowStart: dto.windowStart ? new Date(dto.windowStart) : undefined,
            windowEnd: dto.windowEnd ? new Date(dto.windowEnd) : undefined,
        });

        return {
            status: 'ok',
            insightsPersisted: result.insightsPersisted,
            organizationId: 'org-1',
        };
    }
}
