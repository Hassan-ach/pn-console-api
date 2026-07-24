import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ProfileMetaDataDto } from './dto/profile-meta-data.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {}

    @Get('meta-data')
    @ApiOperation({ summary: 'Get user profile meta data' })
    @ApiOkResponse({ type: ProfileMetaDataDto })
    async getMetaData(
        @Req() req: { user: { id: string } },
    ): Promise<ProfileMetaDataDto> {
        const user = await this.profileService.getMetaData(req.user.id);
        return plainToInstance(ProfileMetaDataDto, user, {
            excludeExtraneousValues: true,
        });
    }
}
