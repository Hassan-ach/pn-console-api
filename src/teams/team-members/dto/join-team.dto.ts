import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class JoinTeamDto {
    @ApiPropertyOptional({
        description: 'Role IDs to assign (must be mapped to this team)',
    })
    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    roleIds?: string[];
}
