import {
    BadRequestException,
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
import { InsightActionRepository } from '../repositories/insight-action.repository';
import { InsightRepository } from '../repositories/insight.repository';
import { INSIGHT_ACTION_MAP } from '../types/insight.types';
import { InsightActionQueryDto } from './dto/insight-action-query.dto';
import { InsightDetailResponseDto } from './dto/insight-detail-response.dto';
import { InsightResponseDto } from './dto/insight-response.dto';
import { InsightsQueryDto } from './dto/insights-query.dto';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('insights')
export class InsightsController {
    constructor(
        private readonly insightRepository: InsightRepository,
        private readonly insightActionRepository: InsightActionRepository,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get insights for the authenticated user' })
    async findAll(
        @Req() req: { user: { id: string } },
        @Query() query: InsightsQueryDto,
    ) {
        return this.insightRepository.findByOwnerId(req.user.id, query.type);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get insight by ID' })
    async findOne(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ) {
        const insight = await this.insightRepository.findById(id, req.user.id);

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
        const insight = await this.insightRepository.findById(id, req.user.id);

        if (!insight) {
            throw new NotFoundException('Insight not found');
        }

        const allowed = INSIGHT_ACTION_MAP[insight.type];
        if (!allowed.includes(query.action)) {
            throw new BadRequestException(
                `Action ${query.action} is not valid for insight type ${insight.type}`,
            );
        }

        const latestVersionId =
            await this.insightRepository.getLatestVersionId(id);

        if (!latestVersionId) {
            throw new NotFoundException('Insight version not found');
        }

        await this.insightActionRepository.upsert(
            latestVersionId,
            req.user.id,
            query.action,
        );

        return this.insightRepository.findById(id, req.user.id);
    }

    @Get(':id/versions')
    @ApiOperation({ summary: 'Get all versions of an insight' })
    @ApiOkResponse({ type: [InsightResponseDto] })
    async findVersions(
        @Req() req: { user: { id: string } },
        @Param('id') id: string,
    ) {
        const versions = await this.insightRepository.findVersionsByInsightId(
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
        const version = await this.insightRepository.findVersionById(
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
        const refs = await this.insightRepository.findVersionEnvelopeRefs(
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
