import { PrismaClient } from '../../generated/app-db-client';
import * as bcrypt from 'bcrypt';

const SUPER_USER_EMAIL = 'superuser@pipenile.com';
const SUPER_USER_PASSWORD = 'SuperUser123!';

const prisma = new PrismaClient();

async function main() {
    const existing = await prisma.user.findUnique({
        where: {
            email_providerType: {
                email: SUPER_USER_EMAIL,
                providerType: 'EMAIL',
            },
        },
    });

    if (existing) {
        console.log(
            `[seed] Super user already exists (${existing.id}), skipping.`,
        );
        return;
    }

    const passwordHash = await bcrypt.hash(SUPER_USER_PASSWORD, 10);

    const user = await prisma.user.create({
        data: {
            firstName: 'Super',
            lastName: 'User',
            email: SUPER_USER_EMAIL,
            passwordHash,
            providerType: 'EMAIL',
        },
    });

    console.log(`[seed] Super user created: ${user.email} (${user.id})`);
}

main()
    .catch((e) => {
        console.error('[seed] Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
