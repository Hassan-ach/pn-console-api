import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitPasswordDto {
    @ApiProperty()
    @IsString()
    pendingId: string;

    @ApiProperty()
    @IsString()
    password: string;
}
