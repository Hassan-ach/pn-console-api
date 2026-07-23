import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
    rawDbUrl: process.env.DATABASE_URL!,
    appDbUrl: process.env.APP_DATABASE_URL!,
}));
