import { ApiProperty } from '@nestjs/swagger';
import { InsightType } from 'src/types/insight.types';

export class InsightResponseDto {
    @ApiProperty({ description: 'The insight ID' })
    id: string;

    @ApiProperty({ description: 'Version number (1, 2, 3...)' })
    version: number;

    @ApiProperty({ enum: InsightType })
    type: InsightType;

    @ApiProperty()
    content: string;
}
