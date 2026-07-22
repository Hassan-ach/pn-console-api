import { registerAs } from '@nestjs/config';

export default registerAs('context', () => ({
    defaultInsightLimit: 20,
    windowMinMessages: 1000,
}));
