import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
    @ApiProperty({ description: 'Team name' })
    name: string;

    @ApiPropertyOptional({ description: 'Team description' })
    description?: string;
}
