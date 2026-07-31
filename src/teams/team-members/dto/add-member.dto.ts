import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AddMemberDto {
    @ApiProperty({ description: 'User ID to add' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Role IDs to assign' })
    @IsArray()
    @IsUUID(undefined, { each: true })
    roleIds: string[];
}
