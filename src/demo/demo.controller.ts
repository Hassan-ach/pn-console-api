import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import { InsightRepository } from '../repositories/insight.repository';

@Controller('demo')
export class DemoController {
    constructor(
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly insightRepository: InsightRepository,
    ) {}

    @Get('envelopes/count')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get envelope count' })
    async getEnvelopeCount(@Query('sourcePlugin') sourcePlugin?: string) {
        const count = await this.envelopeRepo.count(sourcePlugin);
        return { count };
    }

    @Get('insights')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all insights' })
    async getInsights() {
        return this.insightRepository.getAll();
    }
}
