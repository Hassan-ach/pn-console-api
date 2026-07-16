import { IsString, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty()
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.toLowerCase().trim() : value,
    )
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsString()
    @MinLength(8)
    password: string;
}
