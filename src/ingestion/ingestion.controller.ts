import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { IngestionService } from './ingestion.service';

class BackfillDto {
    @IsString()
    plugin: string;

    @IsInt()
    limit: number;
}

@ApiTags('Ingestion')
@Controller('ingestion')
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) {}

    @Post('backfill')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Backfill historical data from a plugin' })
    async backfill(
        @Body() dto: BackfillDto,
        @Req() req: { user: { id: string; organizationId: string } },
    ) {
        const result = await this.ingestionService.ingest({
            plugins: dto.plugin,
            limit: dto.limit,
            userId: req.user.id,
            organizationId: 'org-1',
            triggeredBy: 'user',
        });
        const hasErrors = result.errors.length > 0;
        return {
            success: !hasErrors,
            message: hasErrors
                ? `Data import finished with ${result.errors.length} error(s)`
                : 'Data import completed',
            data: result,
        };
    }
}
