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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeamMembersService } from './team-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JoinTeamDto } from './dto/join-team.dto';

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
    addMember(@Param('teamId') teamId: string, @Body() dto: AddMemberDto) {
        return this.teamMembersService.addMember(teamId, dto);
    }

    @Post('me')
    @ApiOperation({ summary: 'Join the team (any authenticated user)' })
    joinTeam(
        @Param('teamId') teamId: string,
        @Body() dto: JoinTeamDto,
        @Req() req: { user: { id: string } },
    ) {
        return this.teamMembersService.joinTeam(
            teamId,
            req.user.id,
            dto.roleIds ?? [],
        );
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update own membership roles' })
    updateOwnMember(
        @Param('teamId') teamId: string,
        @Body() dto: UpdateMemberDto,
        @Req() req: { user: { id: string } },
    ) {
        return this.teamMembersService.updateMember(teamId, req.user.id, dto);
    }

    @Delete('me')
    @ApiOperation({ summary: 'Leave the team (remove own membership)' })
    removeOwnMember(
        @Param('teamId') teamId: string,
        @Req() req: { user: { id: string } },
    ) {
        return this.teamMembersService.removeMember(teamId, req.user.id);
    }

    @Patch(':userId')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Update member roles (admin only)' })
    updateMember(
        @Param('teamId') teamId: string,
        @Param('userId') userId: string,
        @Body() dto: UpdateMemberDto,
    ) {
        return this.teamMembersService.updateMember(teamId, userId, dto);
    }

    @Delete(':userId')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Remove a user from the team (admin only)' })
    removeMember(
        @Param('teamId') teamId: string,
        @Param('userId') userId: string,
    ) {
        return this.teamMembersService.removeMember(teamId, userId);
    }
}
