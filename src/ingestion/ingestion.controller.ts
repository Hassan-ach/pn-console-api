import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { IngestionService } from './ingestion.service';

class BackfillDto {
    @IsString()
    plugin: string;

    @IsInt()
    limit: number;

    @IsOptional()
    @IsString()
    organizationId?: string;
}

@ApiTags('Ingestion')
@Controller('ingestion')
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) {}

    @Post('backfill')
    @ApiOperation({ summary: 'Backfill historical data from a plugin' })
    async backfill(@Body() dto: BackfillDto) {
        return this.ingestionService.ingest({
            plugins: dto.plugin,
            limit: dto.limit,
            organizationId: dto.organizationId,
            triggeredBy: 'user',
        });
    }
}
