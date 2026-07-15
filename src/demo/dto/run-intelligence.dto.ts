import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RunIntelligenceDto {
    @ApiPropertyOptional({
        description: 'Specific envelope IDs to process (optional)',
        example: ['env-001', 'env-002'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    envelopeIds?: string[];

    @ApiPropertyOptional({
        description: 'Start of time window for envelope selection',
        example: '2026-07-01T00:00:00Z',
    })
    @IsOptional()
    @IsDateString()
    windowStart?: string;

    @ApiPropertyOptional({
        description: 'End of time window for envelope selection',
        example: '2026-07-14T00:00:00Z',
    })
    @IsOptional()
    @IsDateString()
    windowEnd?: string;
}
