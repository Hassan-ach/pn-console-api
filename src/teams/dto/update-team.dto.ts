import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
    @ApiPropertyOptional({ description: 'Team name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Team description' })
    @IsOptional()
    @IsString()
    description?: string;
}
