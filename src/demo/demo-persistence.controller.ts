import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { InsightPersistenceService } from '../intelligence/store/insight-persistence.service';
import { Insight } from '../types/insight.types';
import { PersistInsightsDto } from './dto/persist-insights.dto';

@ApiTags('Demo')
@Controller('demo/insights')
export class DemoPersistenceController {
    constructor(
        private readonly persistence: InsightPersistenceService,
        private readonly prisma: AppDbService,
    ) {}

    @Post('persist')
    @ApiOperation({
        summary: 'Demo: persist extracted insights to the database',
    })
    async persist(@Body() dto: PersistInsightsDto) {
        const insights: Insight[] = dto.insights.map((i) => ({
            id: i.id ?? null,
            type: i.type,
            content: i.content,
            owners: i.owners,
            envolopsRef: i.envolopsRef,
            broadcasted: i.broadcasted ?? false,
        }));

        await this.persistence.persistAll(insights, dto.organizationId);

        return { status: 'ok', persisted: insights.length };
    }

    @Get()
    @ApiOperation({ summary: 'Demo: fetch all insights from the database' })
    async getAll(): Promise<Insight[]> {
        const rows = await this.prisma.insight.findMany({
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { owners: true },
                },
            },
        });

        return rows.map((row) => {
            const latest = row.versions[0];
            return {
                id: row.id,
                organizationId: row.organizationId ?? undefined,
                type: latest.type as Insight['type'],
                content: latest.content,
                owners: latest.owners.map((u) => u.id),
                envolopsRef: [...latest.envolopsRef],
                broadcasted: latest.broadcasted,
                version: latest.version,
                createdAt: latest.createdAt,
            };
        });
    }
}
