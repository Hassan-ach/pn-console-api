import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('teams')
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}

    @Get()
    @ApiOperation({ summary: 'List all teams' })
    findAll() {
        return this.teamsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get team details with members' })
    findOne(@Param('id') id: string) {
        return this.teamsService.findOne(id);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Create a team (admin only)' })
    create(@Body() dto: CreateTeamDto) {
        return this.teamsService.create(dto);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update a team (admin only)' })
    update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
        return this.teamsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Delete a team (admin only)' })
    remove(@Param('id') id: string) {
        return this.teamsService.remove(id);
    }
}
