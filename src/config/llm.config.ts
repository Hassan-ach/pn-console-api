import { registerAs } from '@nestjs/config';

export default registerAs('llm', () => ({
    provider: process.env.LLM_PROVIDER || '',
    model: process.env.LLM_MODEL || '',
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || '',
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
    ownerResolverMaxDistance: parseInt(
        process.env.OWNER_RESOLVER_MAX_DISTANCE || '3',
        10,
    ),
}));
