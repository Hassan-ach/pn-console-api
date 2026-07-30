import { Test, TestingModule } from '@nestjs/testing';
import { InsightEmbeddingListener } from './insight-embedding.listener';
import { EmbeddingService } from '../embeddings/embedding.service';
import { EmbeddingRepository } from 'src/repositories/embedding.repository';

describe('InsightEmbeddingListener', () => {
    let listener: InsightEmbeddingListener;
    let mockEmbeddingService: { embedDocuments: jest.Mock };
    let mockEmbeddingRepo: { upsert: jest.Mock };

    beforeEach(async () => {
        mockEmbeddingService = {
            embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
        };
        mockEmbeddingRepo = {
            upsert: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightEmbeddingListener,
                { provide: EmbeddingService, useValue: mockEmbeddingService },
                { provide: EmbeddingRepository, useValue: mockEmbeddingRepo },
            ],
        }).compile();

        listener = module.get<InsightEmbeddingListener>(InsightEmbeddingListener);
    });

    it('should be defined', () => {
        expect(listener).toBeDefined();
    });

    it('should handle insight.versions.created event asynchronously and upsert vector embeddings', async () => {
        await listener.handleVersionsCreated({
            items: [{ versionId: 'ver-123', content: 'Test insight content' }],
        });

        expect(mockEmbeddingService.embedDocuments).toHaveBeenCalledWith([
            'Test insight content',
        ]);
        expect(mockEmbeddingRepo.upsert).toHaveBeenCalledWith('ver-123', [
            0.1, 0.2, 0.3,
        ]);
    });
});
