import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRoleDto {
    @ApiPropertyOptional({ description: 'Role name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Team ID the role belongs to' })
    @IsOptional()
    @IsUUID()
    teamId?: string;

    @ApiPropertyOptional({ description: 'Role description' })
    @IsOptional()
    @IsString()
    description?: string;
}
