import { PrismaClient } from '../../generated/app-db-client';
import * as bcrypt from 'bcrypt';

const SUPER_USER_EMAIL = 'hassan@pipenile.com';
const SUPER_USER_PASSWORD = 'hassan123!';

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
            firstName: 'hassan',
            lastName: 'hassan',
            email: SUPER_USER_EMAIL,
            passwordHash,
            providerType: 'EMAIL',
            organizationId: 'org-1',
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
