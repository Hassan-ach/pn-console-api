import { Test, TestingModule } from '@nestjs/testing';
import { InsightSuggestionRepository } from './insight-suggestion.repository';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import {
    SuggestionActionType,
    SuggestionStatus,
} from 'generated/app-db-client';

describe('InsightSuggestionRepository', () => {
    let repository: InsightSuggestionRepository;
    let mockAppDb: Record<string, Record<string, jest.Mock>>;

    beforeEach(async () => {
        mockAppDb = {
            insightSuggestion: {
                create: jest.fn(),
                createMany: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                deleteMany: jest.fn(),
                delete: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightSuggestionRepository,
                {
                    provide: AppDbService,
                    useValue: mockAppDb,
                },
            ],
        }).compile();

        repository = module.get<InsightSuggestionRepository>(
            InsightSuggestionRepository,
        );
    });

    it('should create a suggestion', async () => {
        const input = {
            insightId: 'ins-1',
            title: 'Fix issue',
            description: 'Update repository config',
            actionType: SuggestionActionType.RECOMMENDATION,
        };
        const expected = {
            id: 'sug-1',
            ...input,
            status: SuggestionStatus.PENDING,
        };
        mockAppDb.insightSuggestion.create.mockResolvedValue(expected);

        const result = await repository.create(input);

        expect(mockAppDb.insightSuggestion.create).toHaveBeenCalled();
        expect(result.id).toBe('sug-1');
    });

    it('should update suggestion status', async () => {
        mockAppDb.insightSuggestion.update.mockResolvedValue({
            id: 'sug-1',
            status: SuggestionStatus.ACCEPTED,
        });

        const result = await repository.updateStatus(
            'sug-1',
            SuggestionStatus.ACCEPTED,
        );

        expect(mockAppDb.insightSuggestion.update).toHaveBeenCalledWith({
            where: { id: 'sug-1' },
            data: { status: SuggestionStatus.ACCEPTED },
        });
        expect(result.status).toBe(SuggestionStatus.ACCEPTED);
    });
});
