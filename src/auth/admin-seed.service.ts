import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AppDbService } from '../prisma/app-db/app-db.service';
import adminConfig from '../config/admin.config';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
    private readonly logger = new Logger(AdminSeedService.name);

    constructor(
        @Inject(adminConfig.KEY)
        private readonly adminConf: ConfigType<typeof adminConfig>,
        private readonly db: AppDbService,
    ) {}

    async onApplicationBootstrap() {
        const { email, password, firstName, lastName } = this.adminConf;

        if (!email || !password) {
            this.logger.warn(
                'ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed',
            );
            return;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await this.db.user.findFirst({
            where: { email: normalizedEmail },
        });

        if (existing) {
            if (existing.role !== 'ADMIN') {
                await this.db.user.update({
                    where: { id: existing.id },
                    data: { role: 'ADMIN' },
                });
                this.logger.log(
                    `Upgraded existing user ${normalizedEmail} to ADMIN`,
                );
            } else {
                this.logger.log(`Admin user ${normalizedEmail} already exists`);
            }
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await this.db.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                firstName,
                lastName,
                providerType: 'EMAIL',
                role: 'ADMIN',
            },
        });

        this.logger.log(`Admin user created: ${normalizedEmail}`);
    }
}
