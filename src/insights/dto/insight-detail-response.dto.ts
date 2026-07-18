import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsightType } from 'src/types/insight.types';

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
}
