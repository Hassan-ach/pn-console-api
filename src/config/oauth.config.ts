import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => ({
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
    },
    microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID || '',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
        callbackUrl: process.env.MICROSOFT_CALLBACK_URL || '',
    },
    sso: {
        issuer: process.env.SSO_ISSUER || '',
        authorizationUrl: process.env.SSO_AUTHORIZATION_URL || '',
        tokenUrl: process.env.SSO_TOKEN_URL || '',
        userInfoUrl: process.env.SSO_USERINFO_URL || '',
        clientId: process.env.SSO_CLIENT_ID || '',
        clientSecret: process.env.SSO_CLIENT_SECRET || '',
        callbackUrl: process.env.SSO_CALLBACK_URL || '',
    },
}));
