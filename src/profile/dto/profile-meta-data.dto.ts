import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class TeamInfoDto {
    @Expose()
    @ApiProperty({ description: 'Team ID' })
    id: string;

    @Expose()
    @ApiProperty({ description: 'Team name' })
    name: string;

    @Expose()
    @ApiProperty({ description: 'Role names in this team' })
    roles: string[];
}

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

    @Expose()
    @ApiProperty({ description: 'User role (USER or ADMIN)' })
    role: string;

    @Expose()
    @Type(() => TeamInfoDto)
    @ApiPropertyOptional({
        description: 'User teams and roles',
        type: [TeamInfoDto],
    })
    teams?: TeamInfoDto[];
}
