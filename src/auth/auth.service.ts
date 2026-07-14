import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly db: AppDbService,
        private readonly jwtService: JwtService,
    ) {}

    async loginOrCreateMicrosoftUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        let user = await this.db.user.findUnique({
            where: { email: profile.email },
        });

        if (user) {
            const token = this.jwtService.sign({
                sub: user.id,
                email: user.email,
            });

            return {
                access_token: token,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    providerType: user.providerType,
                },
            };
        }

        user = await this.db.user.create({
            data: {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                passwordHash: null,
                providerType: 'MICROSOFT',
            },
        });

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
        });

        return {
            access_token: token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }

    async loginOrCreateSsoUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        let user = await this.db.user.findUnique({
            where: { email: profile.email },
        });

        if (user) {
            const token = this.jwtService.sign({
                sub: user.id,
                email: user.email,
            });

            return {
                access_token: token,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    providerType: user.providerType,
                },
            };
        }

        user = await this.db.user.create({
            data: {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                passwordHash: null,
                providerType: 'SSO',
            },
        });

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
        });

        return {
            access_token: token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }

    async signup(dto: SignupDto) {
        const existing = await this.db.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException(
                'An account with this email already exists. Please log in.',
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.db.user.create({
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                email: dto.email,
                passwordHash,
            },
        });

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
        });

        return {
            access_token: token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }

    async loginOrCreateGoogleUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        let user = await this.db.user.findUnique({
            where: { email: profile.email },
        });

        if (user) {
            const token = this.jwtService.sign({
                sub: user.id,
                email: user.email,
            });

            return {
                access_token: token,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    providerType: user.providerType,
                },
            };
        }

        user = await this.db.user.create({
            data: {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                passwordHash: null,
                providerType: 'GOOGLE',
            },
        });

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
        });

        return {
            access_token: token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }
}
