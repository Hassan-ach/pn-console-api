import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';

interface MicrosoftProfile {
    id: string;
    displayName: string;
    name?: { familyName?: string; givenName?: string; middleName?: string };
    emails?: { value: string; type?: string }[];
    provider: string;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
    constructor(configService: ConfigService) {
        super({
            clientID: configService.getOrThrow<string>('MICROSOFT_CLIENT_ID'),
            clientSecret: configService.getOrThrow<string>(
                'MICROSOFT_CLIENT_SECRET',
            ),
            callbackURL: configService.getOrThrow<string>(
                'MICROSOFT_CALLBACK_URL',
            ),
            scope: ['user.read'],
            tenant: 'common',
        });
    }

    validate(
        _accessToken: string,
        _refreshToken: string,
        profile: MicrosoftProfile,
    ) {
        return {
            email: (profile.emails?.[0]?.value ?? '').toLowerCase(),
            firstName: profile.name?.givenName ?? profile.displayName?.split(' ')[0] ?? '',
            lastName: profile.name?.familyName ?? profile.displayName?.split(' ').slice(1).join(' ') ?? '',
        };
    }
}
