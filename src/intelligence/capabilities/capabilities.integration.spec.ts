import { Test, TestingModule } from '@nestjs/testing';
import { RunnableLambda } from '@langchain/core/runnables';
import { CapabilitiesModule } from './capabilities.module';
import { CapabilityManager } from './capability-manager.service';
import { InsightExtractionCapability } from './insights-extraction/insight-extraction.capability';
import { LlmService } from '../llm/llm.service';

describe('CapabilitiesModule — injection', () => {
  let manager: CapabilityManager;
  let module: TestingModule;

  beforeAll(async () => {
    const fakeStructuredLlm = RunnableLambda.from(async () => ({
      updatedInsights: [],
      newInsights: [],
    }));

    const fakeLlm = {
      withStructuredOutput: jest.fn().mockReturnValue(fakeStructuredLlm),
    };

    module = await Test.createTestingModule({
      imports: [CapabilitiesModule],
    })
      .overrideProvider(LlmService)
      .useValue({
        createLLM: jest.fn().mockResolvedValue(fakeLlm),
      })
      .compile();

    manager = module.get(CapabilityManager);
    await module.init();
  });

  afterAll(async () => {
    await module.close();
  });

  it('registers InsightExtractionCapability as a capability', () => {
    const capabilities = manager.getAll();
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0].name).toBe('insights-extractor');
    expect(capabilities[0]).toBeInstanceOf(InsightExtractionCapability);
  });

  it('can execute the registered capability by name', async () => {
    const result = await manager.executeByName('insights-extractor', {
      chunk: {
        id: 'test',
        envelopes: [],
        metadata: {
          timeRange: { start: new Date(), end: new Date() },
          envelopeCount: 0,
        },
      },
      previousIntelligence: [],
    });

    expect(result.capabilityName).toBe('insights-extractor');
    expect(result.insights).toEqual([]);
  });
});
