import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private readonly mailer: MailerService) {}

    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
        await this.mailer.sendMail({
            to,
            subject: 'Reset your password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                    <h2 style="margin-bottom: 16px;">Password Reset Request</h2>
                    <p style="margin-bottom: 24px; color: #555;">
                        We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.
                    </p>
                    <a href="${resetUrl}"
                       style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Reset Password
                    </a>
                    <p style="margin-top: 24px; color: #999; font-size: 12px;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
            `,
        });

        this.logger.log(`Password reset email sent to ${to}`);
    }
}
