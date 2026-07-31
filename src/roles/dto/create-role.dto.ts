import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
    @ApiProperty({ description: 'Role name' })
    name: string;

    @ApiPropertyOptional({ description: 'Role description' })
    description?: string;
}
