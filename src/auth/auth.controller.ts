import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Post('signup')
    @ApiOperation({ summary: 'Create a new account with email and password' })
    @ApiCreatedResponse({ description: 'User registered successfully' })
    @ApiConflictResponse({ description: 'Email already exists' })
    async signup(@Body() dto: SignupDto) {
        return this.authService.signup(dto);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Initiate Google OAuth login' })
    async googleAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleCallback(@Req() req, @Res() res: Response) {
        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateGoogleUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const redirectUrl = this.oauthRedirectUrl(req, result.access_token, 'google_success=1', frontendUrl);
        res.redirect(redirectUrl);
    }

    @Get('microsoft')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({ summary: 'Initiate Microsoft OAuth login' })
    async microsoftAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Get('microsoft/callback')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({ summary: 'Microsoft OAuth callback' })
    async microsoftCallback(@Req() req, @Res() res: Response) {
        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateMicrosoftUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const redirectUrl = this.oauthRedirectUrl(req, result.access_token, 'microsoft_success=1', frontendUrl);
        res.redirect(redirectUrl);
    }

    @Get('sso')
    @UseGuards(AuthGuard('sso'))
    @ApiOperation({ summary: 'Initiate SSO (OIDC) login' })
    async ssoAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Get('sso/callback')
    @UseGuards(AuthGuard('sso'))
    @ApiOperation({ summary: 'SSO (OIDC) callback' })
    async ssoCallback(@Req() req, @Res() res: Response) {
        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateSsoUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const redirectUrl = this.oauthRedirectUrl(req, result.access_token, 'sso_success=1', frontendUrl);
        res.redirect(redirectUrl);
    }

    private oauthRedirectUrl(req: any, token: string, successParam: string, fallbackUrl: string): string {
        const mode = req.session?.oauthMode;
        if (req.session?.oauthMode) {
            delete req.session.oauthMode;
        }
        if (mode === 'desktop') {
            return `mosaid://auth-callback?access_token=${token}`;
        }
        return `${fallbackUrl}/#signup?access_token=${token}&${successParam}`;
    }
}
