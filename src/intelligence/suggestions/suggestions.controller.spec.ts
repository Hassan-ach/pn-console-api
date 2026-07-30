import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { SuggestionStatus } from 'generated/app-db-client';

describe('SuggestionsController', () => {
    let controller: SuggestionsController;
    let mockSuggestionsService: jest.Mocked<SuggestionsService>;

    beforeEach(async () => {
        mockSuggestionsService = {
            getUserSuggestions: jest.fn(),
            getInsightSuggestions: jest.fn(),
            generateForInsight: jest.fn(),
            updateStatus: jest.fn(),
        } as unknown as jest.Mocked<SuggestionsService>;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [SuggestionsController],
            providers: [
                { provide: SuggestionsService, useValue: mockSuggestionsService },
            ],
        }).compile();

        controller = module.get<SuggestionsController>(SuggestionsController);
    });

    it('getUserSuggestions should pass user id and organizationId', async () => {
        mockSuggestionsService.getUserSuggestions.mockResolvedValue([]);
        const req = { user: { id: 'u1', organizationId: 'org-1' } } as any;

        const result = await controller.getUserSuggestions(req, SuggestionStatus.PENDING);
        expect(mockSuggestionsService.getUserSuggestions).toHaveBeenCalledWith(
            'u1',
            'org-1',
            SuggestionStatus.PENDING,
        );
        expect(result).toEqual([]);
    });

    it('updateStatus should delegate to service', async () => {
        mockSuggestionsService.updateStatus.mockResolvedValue({
            id: 'sug-1',
            status: SuggestionStatus.ACCEPTED,
        } as any);

        const result = await controller.updateStatus('sug-1', {
            status: SuggestionStatus.ACCEPTED,
        });

        expect(mockSuggestionsService.updateStatus).toHaveBeenCalledWith(
            'sug-1',
            SuggestionStatus.ACCEPTED,
        );
        expect(result.status).toBe(SuggestionStatus.ACCEPTED);
    });
});
