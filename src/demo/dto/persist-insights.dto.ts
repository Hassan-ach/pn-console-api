import {
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsightBroadcastLevel, InsightType } from 'src/types/insight.types';

class PersistInsightDto {
    @ApiPropertyOptional({ example: 'abc-123' })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({ enum: InsightType })
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

    @ApiPropertyOptional({
        enum: InsightBroadcastLevel,
        description:
            'Audience level: DIRECT, ORG, TEAM (requires broadcastTarget), ROLE (requires broadcastTarget)',
    })
    @IsOptional()
    @IsIn(Object.values(InsightBroadcastLevel))
    broadcastLevel?: InsightBroadcastLevel;

    @ApiPropertyOptional({
        example: 'Platform Team',
        description:
            'Exact team or role name from the organization, required when broadcastLevel is TEAM or ROLE',
    })
    @IsOptional()
    @IsString()
    broadcastTarget?: string;
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
