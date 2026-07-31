import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
    EVENT_BUS_TOKEN,
    type IEventBus,
} from 'src/common/providers/event-bus/event-bus.interface';
import { Events } from 'src/common/providers/event-bus/events.registry';
import { AppDbService } from '../prisma/app-db/app-db.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { UserSignedUpEvent } from './events/user-signed-up.event';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly db: AppDbService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    ) {}

    async loginOrCreateGoogleUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        return this.loginOrCreateOAuthUser(profile, 'GOOGLE');
    }

    async loginOrCreateMicrosoftUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        return this.loginOrCreateOAuthUser(profile, 'MICROSOFT');
    }

    async loginOrCreateSsoUser(profile: {
        email: string;
        firstName: string;
        lastName: string;
    }) {
        return this.loginOrCreateOAuthUser(profile, 'SSO');
    }

    async signup(dto: SignupDto) {
        const normalizedEmail = dto.email.toLowerCase().trim();

        // Only conflict when the same email + EMAIL provider already exists.
        const existing = await this.db.user.findUnique({
            where: {
                email_providerType: {
                    email: normalizedEmail,
                    providerType: 'EMAIL',
                },
            },
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
                email: normalizedEmail,
                passwordHash,
                providerType: 'EMAIL',
                organizationId: 'org-1',
            },
        });

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            tokenVersion: user.tokenVersion,
            organizationId: user.organizationId ?? 'org-1',
        });

        this.eventBus.publish(
            Events.USER_SIGNED_UP,
            new UserSignedUpEvent(
                user.id,
                user.firstName,
                user.lastName,
                user.email,
            ),
        );

        return {
            access_token: token,
            is_new_user: true,
            user: {
                id: user.id,
                organizationId: user.organizationId ?? 'org-1',
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }

    async login(dto: { email: string; password: string }) {
        const normalizedEmail = dto.email.toLowerCase().trim();

        const user = await this.db.user.findUnique({
            where: {
                email_providerType: {
                    email: normalizedEmail,
                    providerType: 'EMAIL',
                },
            },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException(
                'Incorrect email or password. Please try again.',
            );
        }

        const passwordValid = await bcrypt.compare(
            dto.password,
            user.passwordHash,
        );
        if (!passwordValid) {
            throw new UnauthorizedException(
                'Incorrect email or password. Please try again.',
            );
        }

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            tokenVersion: user.tokenVersion,
            organizationId: user.organizationId ?? 'org-1',
        });

        return {
            access_token: token,
            is_new_user: false,
            user: {
                id: user.id,
                organizationId: user.organizationId ?? 'org-1',
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }

    async logout(userId: string) {
        await this.db.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
        return { message: 'Logged out successfully' };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const normalizedEmail = dto.email.toLowerCase().trim();
        const genericMessage =
            'If an account with that email exists, a reset link has been sent.';

        const user = await this.db.user.findUnique({
            where: {
                email_providerType: {
                    email: normalizedEmail,
                    providerType: 'EMAIL',
                },
            },
        });

        if (user) {
            await this.db.passwordResetToken.deleteMany({
                where: { userId: user.id },
            });

            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await this.db.passwordResetToken.create({
                data: {
                    token,
                    userId: user.id,
                    expiresAt,
                },
            });

            const backendUrl =
                this.configService.getOrThrow<string>('BACKEND_URL');
            const resetUrl = `${backendUrl}/api/auth/relay-reset-token?token=${token}`;

            try {
                await this.mailService.sendPasswordResetEmail(
                    normalizedEmail,
                    resetUrl,
                );
            } catch (err) {
                this.logger.warn(
                    `Failed to send reset email to ${normalizedEmail}: ${err}`,
                );
            }
        }

        return { message: genericMessage };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const resetToken = await this.db.passwordResetToken.findUnique({
            where: { token: dto.token },
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            throw new BadRequestException(
                'Invalid or expired reset link. Please request a new one.',
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.db.user.update({
            where: { id: resetToken.userId },
            data: {
                passwordHash,
                tokenVersion: { increment: 1 },
            },
        });

        await this.db.passwordResetToken.deleteMany({
            where: { userId: resetToken.userId },
        });

        const accessToken = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            tokenVersion: user.tokenVersion,
        });

        return {
            access_token: accessToken,
            message: 'Password updated successfully.',
        };
    }

    async relayResetToken(token: string) {
        const resetToken = await this.db.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            return;
        }

        await this.db.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { relayedAt: new Date() },
        });
    }

    async getPendingReset(email: string) {
        const normalizedEmail = email.toLowerCase().trim();

        const resetToken = await this.db.passwordResetToken.findFirst({
            where: {
                user: { email: normalizedEmail, providerType: 'EMAIL' },
                relayedAt: { not: null },
                expiresAt: { gt: new Date() },
            },
        });

        if (!resetToken) {
            return { token: null };
        }

        return { token: resetToken.token };
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private async loginOrCreateOAuthUser(
        profile: { email: string; firstName: string; lastName: string },
        provider: 'GOOGLE' | 'MICROSOFT' | 'SSO',
    ) {
        const normalizedEmail = profile.email.toLowerCase().trim();

        if (!normalizedEmail) {
            throw new UnauthorizedException(
                'Email not provided by identity provider.',
            );
        }

        const existing = await this.db.user.findUnique({
            where: {
                email_providerType: {
                    email: normalizedEmail,
                    providerType: provider,
                },
            },
        });

        if (existing) {
            const token = this.jwtService.sign({
                sub: existing.id,
                email: existing.email,
                tokenVersion: existing.tokenVersion,
                organizationId: existing.organizationId ?? 'org-1',
            });
            return {
                access_token: token,
                is_new_user: false,
                user: {
                    id: existing.id,
                    organizationId: existing.organizationId ?? 'org-1',
                    firstName: existing.firstName,
                    lastName: existing.lastName,
                    email: existing.email,
                    providerType: existing.providerType,
                },
            };
        }

        let user: Awaited<ReturnType<typeof this.db.user.create>>;
        try {
            user = await this.db.user.create({
                data: {
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    email: normalizedEmail,
                    passwordHash: null,
                    providerType: provider,
                    organizationId: 'org-1',
                },
            });
        } catch (e) {
            // P2002 = unique constraint violation (race: another request created the same user)
            if ((e as { code?: string })?.code === 'P2002') {
                const raceCreated = await this.db.user.findUnique({
                    where: {
                        email_providerType: {
                            email: normalizedEmail,
                            providerType: provider,
                        },
                    },
                });
                if (raceCreated) {
                    const token = this.jwtService.sign({
                        sub: raceCreated.id,
                        email: raceCreated.email,
                        tokenVersion: raceCreated.tokenVersion,
                        organizationId: raceCreated.organizationId ?? 'org-1',
                    });
                    return {
                        access_token: token,
                        is_new_user: false,
                        user: {
                            id: raceCreated.id,
                            organizationId:
                                raceCreated.organizationId ?? 'org-1',
                            firstName: raceCreated.firstName,
                            lastName: raceCreated.lastName,
                            email: raceCreated.email,
                            providerType: raceCreated.providerType,
                        },
                    };
                }
            }
            throw e;
        }

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            tokenVersion: user.tokenVersion,
            organizationId: user.organizationId ?? 'org-1',
        });

        this.eventBus.publish(
            Events.USER_SIGNED_UP,
            new UserSignedUpEvent(
                user.id,
                user.firstName,
                user.lastName,
                user.email,
            ),
        );

        return {
            access_token: token,
            is_new_user: true,
            user: {
                id: user.id,
                organizationId: user.organizationId ?? 'org-1',
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                providerType: user.providerType,
            },
        };
    }
}
