import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppDbModule } from '../prisma/app-db/app-db.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { SsoStrategy } from './strategies/sso.strategy';

@Module({
    imports: [
        AppDbModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: (config.get<string>('JWT_EXPIRATION') ??
                        '7d') as any,
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, GoogleStrategy, MicrosoftStrategy, SsoStrategy],
    exports: [AuthService],
})
export class AuthModule {}
