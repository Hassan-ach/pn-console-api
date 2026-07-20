import {
    Controller,
    Get,
    NotFoundException,
    Param,
    Patch,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
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
    async findAll(
        @Req() req: { user: { id: string } },
        @Query() query: InsightsQueryDto,
    ) {
        return this.insightsService.findAll(req.user.id, query.type);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get insight by ID' })
    async findOne(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ) {
        const insight = await this.insightsService.findOne(id, req.user.id);

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        return insight;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Set action status on an insight' })
    async updateActionStatus(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Query() query: InsightActionQueryDto,
    ) {
        const insight = await this.insightsService.updateActionStatus(
            id,
            req.user.id,
            query.action,
        );

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        return insight;
    }

    @Patch(':id')
    @Get(':id/versions')
    @ApiOperation({ summary: 'Get all versions of an insight' })
    @ApiOkResponse({ type: [InsightResponseDto] })
    async findVersions(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ) {
        const versions = await this.insightsService.findVersions(
            id,
            req.user.id,
        );

        if (!versions) {
            throw new NotFoundException('Insight not found');
        }

        return versions;
    }

    @Get(':id/versions/:versionId')
    @ApiOperation({ summary: 'Get a specific version of an insight' })
    @ApiOkResponse({ type: InsightDetailResponseDto })
    async findVersion(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Param('versionId') versionId: string,
    ) {
        const version = await this.insightsService.findVersion(
            id,
            versionId,
            req.user.id,
        );

        if (!version) {
            throw new NotFoundException('Insight version not found');
        }

        return version;
    }

    @Get(':id/versions/:versionId/envelope-refs')
    @ApiOperation({
        summary: 'Get envelope refs for a specific insight version',
    })
    async findVersionEnvelopeRefs(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
        @Param('versionId') versionId: string,
    ) {
        const refs = await this.insightsService.findVersionEnvelopeRefs(
            id,
            versionId,
            req.user.id,
        );

        if (refs === null) {
            throw new NotFoundException('Insight version not found');
        }

        return refs;
    }
}
