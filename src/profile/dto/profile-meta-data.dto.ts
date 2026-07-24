import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ProfileMetaDataDto {
    @Expose()
    @ApiProperty({ description: 'User ID' })
    id: string;

    @Expose()
    @ApiProperty({ description: 'First name' })
    firstName: string;

    @Expose()
    @ApiProperty({ description: 'Last name' })
    lastName: string | null;

    @Expose()
    @ApiProperty({ description: 'Email address' })
    email: string;
}
