import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { InsightActionStatus, InsightType } from 'src/types/insight.types';

export class InsightResponseDto {
    @Expose()
    @ApiProperty({ description: 'The insight ID' })
    id: string;

    @Expose()
    @ApiProperty({ description: 'Version number (1, 2, 3...)' })
    version: number;

    @Expose()
    @ApiProperty({ enum: InsightType })
    type: InsightType;

    @Expose()
    @ApiProperty()
    content: string;

    @Expose()
    @ApiPropertyOptional({
        enum: InsightActionStatus,
        description: 'Current user action status for this insight',
    })
    status?: InsightActionStatus;

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
