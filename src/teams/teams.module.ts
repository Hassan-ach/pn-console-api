import { Module } from '@nestjs/common';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamMembersController } from './team-members/team-members.controller';
import { TeamMembersService } from './team-members/team-members.service';
import { RolesModule } from '../roles/roles.module';

@Module({
    imports: [AppDbModule, RolesModule, RepositoriesModule],
    controllers: [TeamsController, TeamMembersController],
    providers: [TeamsService, TeamMembersService],
    exports: [TeamsService, TeamMembersService],
})
export class TeamsModule {}
