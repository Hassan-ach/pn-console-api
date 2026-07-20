import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { InsightActionStatus } from 'src/types/insight.types';

export class InsightActionQueryDto {
    @ApiProperty({
        enum: InsightActionStatus,
        description: 'Action to perform on the insight',
    })
    @IsNotEmpty()
    @IsEnum(InsightActionStatus)
    action: InsightActionStatus;
}
