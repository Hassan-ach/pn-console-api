import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { JobStatus } from 'src/types/job.types';

export class JobsQueryDto {
    @ApiPropertyOptional({
        enum: JobStatus,
        description: 'Filter jobs by status',
    })
    @IsOptional()
    @IsEnum(JobStatus)
    status?: JobStatus;
}
