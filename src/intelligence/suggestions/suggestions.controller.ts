import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SuggestionStatus } from 'generated/app-db-client';
import { SuggestionsService } from './suggestions.service';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';

interface AuthenticatedUser {
    id: string;
    organizationId?: string;
}

@ApiTags('Suggestions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('suggestions')
export class SuggestionsController {
    constructor(private readonly suggestionsService: SuggestionsService) {}

    @Get()
    @ApiOperation({
        summary: 'Get list of AI suggestions for the authenticated user',
    })
    @ApiQuery({
        name: 'status',
        enum: SuggestionStatus,
        required: false,
        description: 'Filter suggestions by status',
    })
    @ApiOkResponse({ description: 'List of AI suggestions' })
    async getUserSuggestions(
        @Req() req: Request & { user: AuthenticatedUser },
        @Query('status') status?: SuggestionStatus,
    ) {
        return this.suggestionsService.getUserSuggestions(
            req.user.id,
            req.user.organizationId,
            status,
        );
    }

    @Get('insight/:insightId')
    @ApiOperation({ summary: 'Get or auto-generate AI suggestions for a specific insight item' })
    @ApiOkResponse({ description: 'List of suggestions for the specified insight item' })
    async getInsightSuggestions(
        @Param('insightId') insightId: string,
        @Req() req: Request & { user: AuthenticatedUser },
    ) {
        return this.suggestionsService.getOrGenerateForInsight(
            insightId,
            req.user.id,
            req.user.organizationId,
        );
    }

    @Post('generate/:insightId')
    @ApiOperation({
        summary: 'Trigger manual on-demand AI suggestion generation for an insight',
    })
    @ApiOkResponse({
        description: 'Newly generated AI suggestions for the insight',
    })
    async generateForInsight(
        @Param('insightId') insightId: string,
        @Req() req: Request & { user: AuthenticatedUser },
    ) {
        return this.suggestionsService.generateForInsight(
            insightId,
            req.user.id,
            req.user.organizationId,
        );
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update the status of an AI suggestion' })
    @ApiOkResponse({ description: 'Updated suggestion record' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateSuggestionStatusDto,
    ) {
        return this.suggestionsService.updateStatus(id, dto.status);
    }
}
