import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoleDto {
    @ApiProperty({ description: 'Role name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Team ID the role belongs to' })
    @IsUUID()
    teamId: string;

    @ApiPropertyOptional({ description: 'Role description' })
    @IsOptional()
    @IsString()
    description?: string;
}
