import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { InsightActionStatus, InsightType } from 'src/types/insight.types';

export class InsightDetailResponseDto {
    @Expose()
    @ApiProperty()
    id: string;

    @Expose()
    @ApiPropertyOptional()
    organizationId?: string;

    @Expose()
    @ApiProperty({ enum: InsightType })
    type: InsightType;

    @Expose()
    @ApiProperty()
    content: string;

    @Expose()
    @ApiPropertyOptional({ type: [String] })
    envolopsRef: string[];

    @Expose()
    @ApiPropertyOptional()
    broadcasted: boolean;

    @Expose()
    @ApiProperty({ description: 'Version number (1, 2, 3...)' })
    version: number;

    @Expose()
    @ApiPropertyOptional({ description: 'Latest version ID' })
    latestVersionId: string;

    @Expose()
    @ApiPropertyOptional()
    createdAt: Date;

    @Expose()
    @ApiPropertyOptional()
    sourcePlugin: string;

    @Expose()
    @ApiPropertyOptional({
        enum: InsightActionStatus,
        description: 'Current user action status for this insight',
    })
    status: InsightActionStatus;

    @Expose()
    @ApiPropertyOptional({
        description: 'Priority score (1-10, 10 = most critical)',
    })
    priority?: number;

    @Expose()
    @ApiPropertyOptional({
        description: 'Deadline for time-sensitive insights',
    })
    deadline?: Date;
}
