import {
    Body,
    Controller,
    Delete,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeamMembersService } from './team-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('Team Members')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('teams/:teamId/members')
export class TeamMembersController {
    constructor(private readonly teamMembersService: TeamMembersService) {}

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Add a user to the team (admin only)' })
    addMember(
        @Param('teamId') teamId: string,
        @Body() dto: AddMemberDto,
    ) {
        return this.teamMembersService.addMember(teamId, dto);
    }

    @Patch(':userId')
    @ApiOperation({ summary: 'Update member roles (admin or self)' })
    async updateMember(
        @Param('teamId') teamId: string,
        @Param('userId') userId: string,
        @Body() dto: UpdateMemberDto,
        @Req() req: { user: { id: string; role: string } },
    ) {
        if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
            const { ForbiddenException } = await import('@nestjs/common');
            throw new ForbiddenException('You can only update your own membership');
        }
        return this.teamMembersService.updateMember(teamId, userId, dto);
    }

    @Delete(':userId')
    @ApiOperation({ summary: 'Remove a user from the team (admin or self)' })
    async removeMember(
        @Param('teamId') teamId: string,
        @Param('userId') userId: string,
        @Req() req: { user: { id: string; role: string } },
    ) {
        if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
            const { ForbiddenException } = await import('@nestjs/common');
            throw new ForbiddenException('You can only remove yourself');
        }
        return this.teamMembersService.removeMember(teamId, userId);
    }
}
