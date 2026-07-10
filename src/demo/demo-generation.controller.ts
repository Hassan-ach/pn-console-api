import { randomUUID } from 'crypto';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CapabilityManager } from '../intelligence/capabilities/capability-manager.service';
import { EnvelopeWithPayload } from '../types/envelope.types';
import { DataChunk } from '../intelligence/chunking/types/data-chunk.type';
import { GenerateInsightsDto } from './dto/generate-insights.dto';

@ApiTags('Demo')
@Controller('demo/insights')
export class DemoGenerationController {
    constructor(private readonly capabilityManager: CapabilityManager) {}

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

        const result = await this.capabilityManager.executeByName(
            'insights-extractor',
            { chunk, previousIntelligence: [] },
        );

        return { insights: result.insights };
    }
}
