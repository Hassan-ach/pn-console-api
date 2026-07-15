import { Controller, Get, Query } from '@nestjs/common';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import { InsightRepository } from '../repositories/insight.repository';

@Controller('demo')
export class DemoController {
    constructor(
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly insightRepository: InsightRepository,
    ) {}

    @Get('envelopes/count')
    async getEnvelopeCount(@Query('sourcePlugin') sourcePlugin?: string) {
        const count = await this.envelopeRepo.count(sourcePlugin);
        return { count };
    }

    @Get('insights')
    async getInsights() {
        return this.insightRepository.getAll();
    }
}
