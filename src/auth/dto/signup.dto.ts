import { IsString, IsEmail, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(20)
    firstName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(20)
    lastName: string;

    @ApiProperty()
    @IsEmail()
    @MaxLength(255)
    email: string;

    @ApiProperty()
    @IsString()
    @MinLength(8)
    password: string;
}
