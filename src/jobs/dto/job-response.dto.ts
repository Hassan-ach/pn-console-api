import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { JobStatus } from 'src/types/job.types';

export class JobResponseDto {
    @Expose()
    @ApiProperty({ description: 'Job ID' })
    id: string;

    @Expose()
    @ApiProperty({ description: 'Job title' })
    title: string;

    @Expose()
    @ApiPropertyOptional({ description: 'Job description' })
    description: string | null;

    @Expose()
    @ApiProperty({ description: 'Whether progress tracking is enabled' })
    progressable: boolean;

    @Expose()
    @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
    progress: number | null;

    @Expose()
    @ApiPropertyOptional({ description: 'Status message' })
    message: string | null;

    @Expose()
    @ApiProperty({ enum: JobStatus, description: 'Job status' })
    status: JobStatus;

    @Expose()
    @ApiPropertyOptional({ description: 'When the job started running' })
    startedAt: Date | null;

    @Expose()
    @ApiPropertyOptional({ description: 'When the job completed or failed' })
    completedAt: Date | null;

    @Expose()
    @ApiProperty({ description: 'Created timestamp' })
    createdAt: Date;

    @Expose()
    @ApiProperty({ description: 'Last updated timestamp' })
    updatedAt: Date;
}
