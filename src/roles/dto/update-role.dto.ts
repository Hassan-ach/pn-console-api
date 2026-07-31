import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
    @ApiPropertyOptional({ description: 'Role name' })
    name?: string;

    @ApiPropertyOptional({ description: 'Role description' })
    description?: string;
}
