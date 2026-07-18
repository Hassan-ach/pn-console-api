import {
    Controller,
    Get,
    NotFoundException,
    Param,
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
import { InsightRepository } from '../repositories/insight.repository';
import { InsightDetailResponseDto } from './dto/insight-detail-response.dto';
import { InsightResponseDto } from './dto/insight-response.dto';
import { InsightsQueryDto } from './dto/insights-query.dto';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('insights')
export class InsightsController {
    constructor(private readonly insightRepository: InsightRepository) {}

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
}
