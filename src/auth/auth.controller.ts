import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
    constructor(private readonly authService: AuthService) {}

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
    async googleCallback(@Req() req) {
        return this.authService.loginOrCreateGoogleUser({
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
        });
    }
}
