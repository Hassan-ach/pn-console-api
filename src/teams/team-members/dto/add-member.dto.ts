import { ApiProperty } from '@nestjs/swagger';

export class AddMemberDto {
    @ApiProperty({ description: 'User ID to add' })
    userId: string;

    @ApiProperty({ description: 'Role IDs to assign' })
    roleIds: string[];
}
