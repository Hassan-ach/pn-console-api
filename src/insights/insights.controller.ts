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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsightRepository } from '../repositories/insight.repository';
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
}
