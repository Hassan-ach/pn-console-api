import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTeamDto {
    @ApiPropertyOptional({ description: 'Team name' })
    name?: string;

    @ApiPropertyOptional({ description: 'Team description' })
    description?: string;
}
