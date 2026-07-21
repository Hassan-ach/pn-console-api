import {
    Controller,
    Get,
    Param,
    Patch,
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
import { InsightActionQueryDto } from './dto/insight-action-query.dto';
import { InsightDetailResponseDto } from './dto/insight-detail-response.dto';
import { InsightResponseDto } from './dto/insight-response.dto';
import { InsightsQueryDto } from './dto/insights-query.dto';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('insights')
export class InsightsController {
    constructor(private readonly insightsService: InsightsService) {}

    @Get()
    @ApiOperation({ summary: 'Get insights for the authenticated user' })
    findAll(
        @Req() req: { user: { id: string } },
        @Query(ValidationPipe) query: InsightsQueryDto,
    ) {
        return this.insightsService.findAllForUser(req.user.id, query.type);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get insight by ID' })
    @ApiOkResponse({ type: InsightDetailResponseDto })
    async findOne(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ): Promise<InsightDetailResponseDto> {
        const insight = await this.insightsService.findOneForUser(
            id,
            req.user.id,
        );

        return plainToInstance(InsightDetailResponseDto, insight);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Set action status on an insight' })
    updateActionStatus(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Query(ValidationPipe) query: InsightActionQueryDto,
    ) {
        return this.insightsService.updateActionStatus(
            id,
            req.user.id,
            query.action,
        );
    }

    @Patch(':id')
    @Get(':id/versions')
    @ApiOperation({ summary: 'Get all versions of an insight' })
    @ApiOkResponse({ type: [InsightResponseDto] })
    async findVersions(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ): Promise<InsightResponseDto[]> {
        const versions = await this.insightsService.findVersionsForUser(
            id,
            req.user.id,
        );

        return plainToInstance(InsightResponseDto, versions);
    }

    @Get(':id/versions/:versionId')
    @ApiOperation({ summary: 'Get a specific version of an insight' })
    @ApiOkResponse({ type: InsightDetailResponseDto })
    async findVersion(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Param('versionId') versionId: string,
    ): Promise<InsightDetailResponseDto> {
        const version = await this.insightsService.findVersionForUser(
            id,
            versionId,
            req.user.id,
        );

        return plainToInstance(InsightDetailResponseDto, version);
    }

    @Get(':id/versions/:versionId/envelope-refs')
    @ApiOperation({
        summary: 'Get envelope refs for a specific insight version',
    })
    findVersionEnvelopeRefs(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Param('versionId') versionId: string,
    ) {
        return this.insightsService.findVersionEnvelopeRefs(
            id,
            versionId,
            req.user.id,
        );
    }
}
