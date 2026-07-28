import { Body, Controller, Post, Req, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsString,
    Min,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { IngestionService } from './services/ingestion.service';

class ChatLimitDto {
    @IsString()
    chatId: string;

    @IsString()
    chatName: string;

    @IsInt()
    @Min(1)
    limit: number;
}

class BackfillItemDto {
    @IsString()
    plugin: string;

    @ValidateNested({ each: true })
    @Type(() => ChatLimitDto)
    @ArrayMinSize(1)
    chats: ChatLimitDto[];
}

@ApiTags('Ingestion')
@Controller('ingestion')
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) {}

    @Post('backfill')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Backfill historical data from plugins' })
    async backfill(
        @Body(new ValidationPipe({ transform: true })) dtos: BackfillItemDto[],
        @Req() req: { user: { id: string; organizationId: string } },
    ) {
        const result = await this.ingestionService.ingest({
            plugins: dtos.map((d) => ({
                name: d.plugin,
                chats: d.chats.map((c) => ({
                    chatId: c.chatId,
                    chatName: c.chatName,
                    limit: c.limit,
                })),
            })),
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
