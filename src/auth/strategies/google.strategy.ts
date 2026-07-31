import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(configService: ConfigService) {
        super({
            clientID:
                configService.get<string>('oauth.google.clientId') ||
                configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
            clientSecret:
                configService.get<string>('oauth.google.clientSecret') ||
                configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
            callbackURL:
                configService.get<string>('oauth.google.callbackUrl') ||
                configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
            scope: ['email', 'profile'],
        });
    }

    authorizationParams(): { prompt: string } {
        return { prompt: 'select_account' };
    }

    validate(_accessToken: string, _refreshToken: string, profile: Profile) {
        return {
            email: (profile.emails?.[0]?.value ?? '').toLowerCase(),
            firstName: profile.name?.givenName ?? '',
            lastName: profile.name?.familyName ?? '',
        };
    }
}
