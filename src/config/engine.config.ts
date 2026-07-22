import { registerAs } from '@nestjs/config';

export default registerAs('engine', () => ({
    previousInsightLimit: 5,
}));
