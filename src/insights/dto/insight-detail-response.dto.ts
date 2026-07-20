import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsightActionStatus, InsightType } from 'src/types/insight.types';

export class InsightDetailResponseDto {
    @ApiProperty()
    id: string;

    @ApiPropertyOptional()
    organizationId?: string;

    @ApiProperty({ enum: InsightType })
    type: InsightType;

    @ApiProperty()
    content: string;

    @ApiPropertyOptional({ type: [String] })
    envolopsRef?: string[];

    @ApiPropertyOptional()
    broadcasted?: boolean;

    @ApiProperty({ description: 'Version number (1, 2, 3...)' })
    version: number;

    @ApiPropertyOptional({ description: 'Latest version ID' })
    latestVersionId?: string;

    @ApiPropertyOptional()
    createdAt?: Date;

    @ApiPropertyOptional()
    sourcePlugin?: string;

    @ApiPropertyOptional()
    groupId?: string;

    @ApiPropertyOptional()
    channelId?: string;

    @ApiPropertyOptional()
    topicId?: string;

    @ApiPropertyOptional({
        enum: InsightActionStatus,
        description: 'Current user action status for this insight',
    })
    status?: InsightActionStatus;
}
