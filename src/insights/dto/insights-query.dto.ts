import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { InsightType } from 'src/types/insight.types';

export class InsightsQueryDto {
    @ApiPropertyOptional({ enum: InsightType })
    @IsOptional()
    @IsEnum(InsightType)
    type?: InsightType;
}
