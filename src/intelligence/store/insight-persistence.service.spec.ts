import { Test, TestingModule } from '@nestjs/testing';
import { RunnableLambda } from '@langchain/core/runnables';
import { InsightExtractorService } from '../capabilities/insights-extractor/insights-extractor.service';
import { LlmService } from '../llm/llm.service';
import { InsightResultSchema } from '../capabilities/insights-extractor/insight-schema';
import {
  InputInsight,
  InputMessage,
} from '../capabilities/insights-extractor/types';

const sampleHistory: InputInsight[] = [
  {
    id: 1,
    type: 'TASK',
    content: 'Send the Q3 budget report to the finance team',
  },
  {
    id: 2,
    type: 'URGENCY',
    content: 'Production server CPU usage spiking above 90%',
  },
];

const sampleMessages: InputMessage[] = [
  {
    id: '1',
    type: 'direct',
    content: 'Q3 budget report has been sent to finance, all done.',
    reply_to: null,
    reactions: {},
    pinned: false,
    edited_date: null,
    entities: null,
  },
];

const sampleResult = {
  updatedInsights: [
    { id: 1, type: 'INFO', content: 'Q3 budget report was sent to finance.' },
  ],
  newInsights: [],
};

describe('InsightExtractorService', () => {
  let service: InsightExtractorService;
  let modelInvoke: jest.Mock<Promise<unknown>, []>;

  beforeEach(async () => {
    modelInvoke = jest.fn().mockResolvedValue(sampleResult);

    const fakeStructuredLlm = RunnableLambda.from(async () => {
      const value = await modelInvoke();
      return InsightResultSchema.parse(value);
    });

    const fakeLlm = {
      withStructuredOutput: jest.fn().mockReturnValue(fakeStructuredLlm),
    };

    const llmServiceMock = {
      createLLM: jest.fn().mockResolvedValue(fakeLlm),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightExtractorService,
        { provide: LlmService, useValue: llmServiceMock },
      ],
    }).compile();

    service = module.get<InsightExtractorService>(InsightExtractorService);
    await service.onModuleInit();
  });

  it('should connect to llm', async () => {
    const response = await service.extractInsights([], []);

    expect(response).toBeTruthy();
  });

  it('should return a valid schema', async () => {
    const result = await service.extractInsights(sampleHistory, sampleMessages);

    const parsed = InsightResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('should throw because LLM service is unreachable', async () => {
    modelInvoke.mockRejectedValue(new Error('network error'));

    await expect(service.extractInsights([], [])).rejects.toThrow(
      'insights extraction failed after 3 attempts',
    );
  });

  it('should throw because of unstructured output', async () => {
    modelInvoke.mockResolvedValue({ newInsights: {} });

    await expect(service.extractInsights([], [])).rejects.toThrow(
      'insights extraction failed after 3 attempts',
    );
  });
});
