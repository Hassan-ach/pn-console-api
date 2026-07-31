import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppDbService } from '../../prisma/app-db/app-db.service';

const MAX_TOKEN_AGE_DAYS = 30;

@Injectable()
export class JwtLogoutStrategy extends PassportStrategy(
    Strategy,
    'jwt-logout',
) {
    constructor(
        configService: ConfigService,
        private readonly db: AppDbService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey:
                configService.get<string>('jwt.secret') ||
                configService.getOrThrow<string>('JWT_SECRET'),
            ignoreExpiration: true,
        });
    }

    async validate(payload: {
        sub: string;
        email: string;
        tokenVersion: number;
        exp?: number;
    }) {
        if (
            payload.exp &&
            Date.now() / 1000 - payload.exp > MAX_TOKEN_AGE_DAYS * 24 * 60 * 60
        ) {
            throw new UnauthorizedException('Token has been revoked.');
        }

        const user = await this.db.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                providerType: true,
                tokenVersion: true,
            },
        });

        if (!user || user.tokenVersion !== payload.tokenVersion) {
            throw new UnauthorizedException('Token has been revoked.');
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            providerType: user.providerType,
        };
    }
}
