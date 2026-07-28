import { registerAs } from '@nestjs/config';

export default registerAs('engine', () => ({
    previousInsightLimit: 5,
    insightDeadlineWarningDays: parseInt(
        process.env.INSIGHT_DEADLINE_WARNING_DAYS ?? '3',
        10,
    ),
}));
