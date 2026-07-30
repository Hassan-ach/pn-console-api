import { registerAs } from '@nestjs/config';

export default registerAs('embeddings', () => ({
    provider: process.env.EMBEDDING_PROVIDER || 'openai',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
    apiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || '',
    baseUrl: process.env.EMBEDDING_BASE_URL || 'http://localhost:11434',
}));
