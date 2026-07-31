import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppDbService } from '../../prisma/app-db/app-db.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly db: AppDbService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
        });
    }

    async validate(payload: {
        sub: string;
        email: string;
        tokenVersion: number;
        role: string;
    }) {
        const user = await this.db.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                organizationId: true,
                email: true,
                firstName: true,
                lastName: true,
                providerType: true,
                tokenVersion: true,
                role: true,
            },
        });

        if (!user || user.tokenVersion !== payload.tokenVersion) {
            throw new UnauthorizedException('Token has been revoked.');
        }

        return {
            id: user.id,
            organizationId: user.organizationId ?? 'org-1',
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            providerType: user.providerType,
            role: user.role,
        };
    }
}
