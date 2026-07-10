import { Controller, Get, Query } from '@nestjs/common';
import { EnvelopeService } from '../envelope/envelope.service';
import { InsightRepository } from '../repositories/insight.repository';

@Controller('demo')
export class DemoController {
    constructor(
        private readonly envelopeService: EnvelopeService,
        private readonly insightRepository: InsightRepository,
    ) {}

    @Get('envelopes/count')
    async getEnvelopeCount(@Query('sourcePlugin') sourcePlugin?: string) {
        const count = await this.envelopeService.count(sourcePlugin);
        return { count };
    }

    @Get('insights')
    async getInsights() {
        return this.insightRepository.getAll();
    }
}
