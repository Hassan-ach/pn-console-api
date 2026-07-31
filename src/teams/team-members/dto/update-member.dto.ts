import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateMemberDto {
    @ApiProperty({ description: 'Role IDs to assign' })
    @IsArray()
    @IsUUID(undefined, { each: true })
    roleIds: string[];
}
