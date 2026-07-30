import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';

@Injectable()
export class EmbeddingService implements OnModuleInit {
    private embedder: EmbeddingsInterface | null = null;

    constructor(private readonly config: ConfigService) {}

    async onModuleInit(): Promise<void> {
        await this.initEmbedder();
    }

    private async initEmbedder(): Promise<void> {
        const provider = this.config.get<string>(
            'embeddings.provider',
            'openai',
        );
        const model = this.config.get<string>(
            'embeddings.model',
            'text-embedding-3-small',
        );
        const apiKey =
            this.config.get<string>('embeddings.apiKey') || undefined;

        switch (provider) {
            case 'openai': {
                const { OpenAIEmbeddings } = await import('@langchain/openai');
                this.embedder = new OpenAIEmbeddings({
                    model,
                    apiKey,
                    dimensions: this.config.get<number>(
                        'embeddings.dimensions',
                        1536,
                    ),
                });
                break;
            }
            case 'ollama': {
                const { OllamaEmbeddings } = await import('@langchain/ollama');
                this.embedder = new OllamaEmbeddings({
                    model: model || 'nomic-embed-text',
                    baseUrl: this.config.get<string>(
                        'embeddings.baseUrl',
                        'http://localhost:11434',
                    ),
                });
                break;
            }
            case 'google-genai': {
                const { GoogleGenerativeAIEmbeddings } =
                    await import('@langchain/google-genai');
                this.embedder = new GoogleGenerativeAIEmbeddings({
                    model: model || 'text-embedding-004',
                    apiKey,
                });
                break;
            }
            default:
                throw new Error(`Unsupported embedding provider: ${provider}`);
        }
    }

    async embed(text: string): Promise<number[]> {
        if (!this.embedder) {
            throw new Error('Embedding service not initialized');
        }
        return this.embedder.embedQuery(text);
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        if (!this.embedder) {
            throw new Error('Embedding service not initialized');
        }
        return this.embedder.embedDocuments(texts);
    }
}
