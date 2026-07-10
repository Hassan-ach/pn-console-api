import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsightPersistenceService } from '../intelligence/store/insight-persistence.service';
import { Insight } from '../types/insight.types';
import { PersistInsightsDto } from './dto/persist-insights.dto';

@ApiTags('Demo')
@Controller('demo/insights')
export class DemoPersistenceController {
    constructor(private readonly persistence: InsightPersistenceService) {}

    @Post('persist')
    @ApiOperation({ summary: 'Demo: persist extracted insights to the database' })
    async persist(@Body() dto: PersistInsightsDto) {
        const insights: Insight[] = dto.insights.map((i) => ({
            id: null,
            type: i.type,
            content: i.content,
            owners: i.owners,
            envolopsRef: i.envolopsRef,
            broadcasted: i.broadcasted ?? false,
        }));

        await this.persistence.persistAll(insights, dto.organizationId);

        return { status: 'ok', persisted: insights.length };
    }
}
