import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Public()
    @Post('signup')
    @ApiOperation({ summary: 'Create a new account with email and password' })
    @ApiCreatedResponse({ description: 'User registered successfully' })
    @ApiConflictResponse({ description: 'Email already exists' })
    async signup(@Body() dto: SignupDto) {
        return this.authService.signup(dto);
    }

    @Public()
    @Post('login')
    @ApiOperation({ summary: 'Log in with email and password' })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @Post('logout')
    @UseGuards(AuthGuard('jwt-logout'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Log out and revoke current token' })
    @ApiOkResponse({ description: 'Logged out successfully' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
    async logout(@Req() req: any) {
        return this.authService.logout(req.user.id);
    }

    @Public()
    @Get('google')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Initiate Google OAuth login' })
    async googleAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Public()
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleCallback(@Req() req, @Res() res: Response) {
        const frontendUrl =
            this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateGoogleUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const successParam = result.is_new_user ? 'google_success=1' : '';
        const redirectUrl = this.oauthRedirectUrl(
            result.access_token,
            successParam,
            frontendUrl,
            result.is_new_user,
        );
        res.redirect(redirectUrl);
    }

    @Public()
    @Get('microsoft')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({ summary: 'Initiate Microsoft OAuth login' })
    async microsoftAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Public()
    @Get('microsoft/callback')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({ summary: 'Microsoft OAuth callback' })
    async microsoftCallback(@Req() req, @Res() res: Response) {
        const frontendUrl =
            this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateMicrosoftUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const successParam = result.is_new_user ? 'microsoft_success=1' : '';
        const redirectUrl = this.oauthRedirectUrl(
            result.access_token,
            successParam,
            frontendUrl,
            result.is_new_user,
        );
        res.redirect(redirectUrl);
    }

    @Public()
    @Get('sso')
    @UseGuards(AuthGuard('sso'))
    @ApiOperation({ summary: 'Initiate SSO (OIDC) login' })
    async ssoAuth() {
        // Passport handles the redirect — no implementation needed
    }

    @Public()
    @Get('sso/callback')
    @UseGuards(AuthGuard('sso'))
    @ApiOperation({ summary: 'SSO (OIDC) callback' })
    async ssoCallback(@Req() req, @Res() res: Response) {
        const frontendUrl =
            this.configService.getOrThrow<string>('FRONTEND_URL');
        const result = await this.authService.loginOrCreateSsoUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
        const successParam = result.is_new_user ? 'sso_success=1' : '';
        const redirectUrl = this.oauthRedirectUrl(
            result.access_token,
            successParam,
            frontendUrl,
            result.is_new_user,
        );
        res.redirect(redirectUrl);
    }

    private oauthRedirectUrl(
        token: string,
        successParam: string,
        fallbackUrl: string,
        isNewUser: boolean,
    ): string {
        const query = successParam ? `&${successParam}` : '';
        const target = isNewUser ? 'signup' : 'dashboard';
        return `${fallbackUrl}/#${target}?access_token=${token}${query}`;
    }
}
