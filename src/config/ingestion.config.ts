import { registerAs } from '@nestjs/config';

export default registerAs('ingestion', () => ({
    backfillDayThreshold: 60,
}));
