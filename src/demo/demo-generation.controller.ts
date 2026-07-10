import { randomUUID } from 'crypto';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CapabilityManager } from '../intelligence/capabilities/capability-manager.service';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { EnvelopeWithPayload } from '../types/envelope.types';
import { Insight } from '../types/insight.types';
import { DataChunk } from '../intelligence/chunking/types/data-chunk.type';
import { GenerateInsightsDto } from './dto/generate-insights.dto';

@ApiTags('Demo')
@Controller('demo/insights')
export class DemoGenerationController {
    constructor(
        private readonly capabilityManager: CapabilityManager,
        private readonly prisma: AppDbService,
    ) {}

    @Post('generate')
    @ApiOperation({ summary: 'Demo: extract insights from messages using the LLM' })
    async generate(@Body() dto: GenerateInsightsDto) {
        const envelopes: EnvelopeWithPayload[] = dto.messages.map((msg) => ({
            envelope: {
                id: randomUUID(),
                sourcePlugin: 'demo',
                sourceId: randomUUID(),
                type: 'message' as const,
                hasAttachment: false,
                authorId: msg.authorId ?? null,
                occurredAt: new Date(),
                organizationId: dto.organizationId,
            },
            payload: {
                type: msg.type ?? ('direct' as const),
                content: msg.content,
                groupId: msg.groupId ?? null,
                channelId: msg.channelId ?? null,
                replyTo: null,
                reactions: {},
                pinned: false,
                editedDate: null,
                entities: null,
                rawPayload: {},
            },
        }));

        const chunk: DataChunk = {
            id: randomUUID(),
            envelopes,
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: envelopes.length,
            },
        };

        const rows = await this.prisma.insight.findMany({
            where: { organizationId: dto.organizationId },
            include: {
                versions: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });

        const previousIntelligence: Insight[] = rows.map((row) => {
            const latest = row.versions[0];
            return {
                id: row.id,
                organizationId: row.organizationId ?? undefined,
                type: latest.type as Insight['type'],
                content: latest.content,
                owners: [...latest.owners],
                envolopsRef: [...latest.envolopsRef],
                broadcasted: latest.broadcasted,
                version: latest.version,
                createdAt: latest.createdAt,
            };
        });

        const result = await this.capabilityManager.executeByName(
            'insights-extractor',
            { chunk, previousIntelligence },
        );

        return { insights: result.insights };
    }
}
