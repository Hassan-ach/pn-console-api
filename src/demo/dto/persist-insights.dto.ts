import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { InsightType } from 'src/types/insight.types';

class PersistInsightDto {
    @ApiProperty({ enum: ['TASK', 'URGENCY', 'INFO', 'DECISION'] })
    @IsString()
    type: InsightType;

    @ApiProperty({ example: 'Deploy hotfix to production by Friday' })
    @IsString()
    content: string;

    @ApiProperty({ example: ['Alice', 'Bob'] })
    @IsArray()
    @IsString({ each: true })
    owners: string[];

    @ApiProperty({ example: ['env-1', 'env-2'], required: false })
    @IsArray()
    @IsString({ each: true })
    envolopsRef?: string[];

    @ApiProperty({ required: false, default: false })
    broadcasted?: boolean;
}

export class PersistInsightsDto {
    @ApiProperty({ example: 'org-abc-123' })
    @IsString()
    organizationId: string;

    @ApiProperty({ type: [PersistInsightDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PersistInsightDto)
    insights: PersistInsightDto[];
}
