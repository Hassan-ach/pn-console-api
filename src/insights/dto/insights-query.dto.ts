import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
    InsightActionStatus,
    InsightType,
} from 'src/types/insight.types';

export class InsightsQueryDto {
    @ApiPropertyOptional({ enum: InsightType })
    @IsOptional()
    @IsEnum(InsightType)
    type?: InsightType;

    @ApiPropertyOptional({ enum: InsightActionStatus })
    @IsOptional()
    @IsEnum(InsightActionStatus)
    status?: InsightActionStatus;
}
