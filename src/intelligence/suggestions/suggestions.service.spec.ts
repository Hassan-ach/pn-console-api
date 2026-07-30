import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { InsightSuggestionRepository } from 'src/repositories/insight-suggestion.repository';
import { InsightRepository } from 'src/repositories/insight.repository';
import { CapabilityManager } from '../capabilities/capability-manager.service';
import { SuggestionStatus } from 'generated/app-db-client';
import { NotFoundException } from '@nestjs/common';

describe('SuggestionsService', () => {
    let service: SuggestionsService;
    let mockSuggestionRepo: jest.Mocked<InsightSuggestionRepository>;
    let mockInsightRepo: jest.Mocked<InsightRepository>;
    let mockCapabilityManager: jest.Mocked<CapabilityManager>;

    beforeEach(async () => {
        mockSuggestionRepo = {
            findByUser: jest.fn(),
            findByInsightId: jest.fn(),
            findById: jest.fn(),
            updateStatus: jest.fn(),
        } as unknown as jest.Mocked<InsightSuggestionRepository>;

        mockInsightRepo = {
            findById: jest.fn(),
        } as unknown as jest.Mocked<InsightRepository>;

        mockCapabilityManager = {
            executeByName: jest.fn(),
        } as unknown as jest.Mocked<CapabilityManager>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SuggestionsService,
                {
                    provide: InsightSuggestionRepository,
                    useValue: mockSuggestionRepo,
                },
                { provide: InsightRepository, useValue: mockInsightRepo },
                { provide: CapabilityManager, useValue: mockCapabilityManager },
            ],
        }).compile();

        service = module.get<SuggestionsService>(SuggestionsService);
    });

    it('getUserSuggestions should call repository.findByUser', async () => {
        mockSuggestionRepo.findByUser.mockResolvedValue([]);
        const result = await service.getUserSuggestions(
            'u1',
            'org-1',
            SuggestionStatus.PENDING,
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockSuggestionRepo.findByUser).toHaveBeenCalledWith(
            'u1',
            'org-1',
            {
                status: SuggestionStatus.PENDING,
            },
        );
        expect(result).toEqual([]);
    });

    it('getInsightSuggestions should throw NotFoundException when insight not found', async () => {
        mockInsightRepo.findById.mockResolvedValue(null);
        await expect(
            service.getInsightSuggestions('ins-99', 'org-1'),
        ).rejects.toThrow(NotFoundException);
    });

    it('updateStatus should update suggestion status', async () => {
        mockSuggestionRepo.findById.mockResolvedValue({ id: 'sug-1' } as never);
        mockSuggestionRepo.updateStatus.mockResolvedValue({
            id: 'sug-1',
            status: SuggestionStatus.ACCEPTED,
        } as never);

        const result = await service.updateStatus(
            'sug-1',
            SuggestionStatus.ACCEPTED,
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockSuggestionRepo.updateStatus).toHaveBeenCalledWith(
            'sug-1',
            SuggestionStatus.ACCEPTED,
        );
        expect(result.status).toBe(SuggestionStatus.ACCEPTED);
    });
});
