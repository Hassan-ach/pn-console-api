import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberDto {
    @ApiProperty({ description: 'Role IDs to assign' })
    roleIds: string[];
}
