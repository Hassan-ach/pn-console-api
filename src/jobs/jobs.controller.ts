import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JobResponseDto } from './dto/job-response.dto';
import { JobsQueryDto } from './dto/jobs-query.dto';
import { JobService } from './job.service';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('jobs')
export class JobsController {
    constructor(private readonly jobService: JobService) {}

    @Get()
    @ApiOperation({ summary: 'Get jobs for the authenticated user' })
    @ApiOkResponse({ type: [JobResponseDto] })
    async findAll(
        @Req() req: { user: { id: string } },
        @Query(ValidationPipe) query: JobsQueryDto,
    ): Promise<JobResponseDto[]> {
        const jobs = await this.jobService.getJobsByUser(
            req.user.id,
            query.status,
        );
        return plainToInstance(JobResponseDto, jobs);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get job by ID' })
    @ApiOkResponse({ type: JobResponseDto })
    async findOne(@Param('id') id: string): Promise<JobResponseDto> {
        const job = await this.jobService.getJob(id);
        return plainToInstance(JobResponseDto, job);
    }
}
