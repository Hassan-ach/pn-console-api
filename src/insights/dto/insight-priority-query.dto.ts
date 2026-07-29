import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class InsightPriorityQueryDto {
    @ApiProperty({
        description: 'Priority score (1-10, 10 = most critical)',
        minimum: 1,
        maximum: 10,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(10)
    priority: number;
}
