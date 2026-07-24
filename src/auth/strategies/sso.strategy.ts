import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-openidconnect';

@Injectable()
export class SsoStrategy extends PassportStrategy(Strategy, 'sso') {
    constructor(configService: ConfigService) {
        super({
            issuer: configService.getOrThrow<string>('SSO_ISSUER'),
            authorizationURL: configService.getOrThrow<string>(
                'SSO_AUTHORIZATION_URL',
            ),
            tokenURL: configService.getOrThrow<string>('SSO_TOKEN_URL'),
            userInfoURL: configService.getOrThrow<string>('SSO_USERINFO_URL'),
            clientID: configService.getOrThrow<string>('SSO_CLIENT_ID'),
            clientSecret: configService.getOrThrow<string>('SSO_CLIENT_SECRET'),
            callbackURL: configService.getOrThrow<string>('SSO_CALLBACK_URL'),
            scope: 'openid profile email',
            prompt: 'login',
        });
    }

    validate(
        _issuer: string,
        profile: {
            displayName?: string;
            name?: { givenName?: string; familyName?: string };
            emails?: Array<{ value: string }>;
        },
    ) {
        return {
            email: (profile.emails?.[0]?.value ?? '').toLowerCase(),
            firstName:
                profile.name?.givenName ??
                profile.displayName?.split(' ')[0] ??
                '',
            lastName:
                profile.name?.familyName ??
                profile.displayName?.split(' ').slice(1).join(' ') ??
                '',
        };
    }
}
