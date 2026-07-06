import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { InjectionService } from './injection.service';

class BackfillDto {
    @IsString()
    plugin: string;

    @IsInt()
    limit: number;
}

@ApiTags('Injection')
@Controller('injection')
export class InjectionController {
    constructor(private readonly injectionService: InjectionService) {}

    @Post('backfill')
    @ApiOperation({ summary: 'Backfill historical data from a plugin' })
    async backfill(@Body() dto: BackfillDto) {
        return this.injectionService.ingest(dto.plugin, dto.limit);
    }
}
