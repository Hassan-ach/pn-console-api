import { SYSTEM_PROMPT as V2_PROMPT } from '../insights-extraction-v2/insight-extraction-v2-prompt';
import { SYSTEM_PROMPT as V1_PROMPT } from './insight-extraction-prompt';

describe('insight extraction prompts', () => {
    it('V2 prompt forbids orphaned insights', () => {
        expect(V2_PROMPT).toContain('HARD RULES');
        expect(V2_PROMPT).toContain(
            'EVERY insight MUST have at least one owners entry',
        );
        expect(V2_PROMPT).toContain('NEVER create an orphaned insight');
    });

    it('V2 prompt requires DIRECT to have owners', () => {
        expect(V2_PROMPT).toContain('requires at least one entry in owners');
    });

    it('V1 prompt forbids orphaned insights', () => {
        expect(V1_PROMPT).toContain('Never create an orphaned insight');
        expect(V1_PROMPT).toContain(
            'owners: [] combined with "DIRECT" (or missing) broadcastLevel is INVALID',
        );
    });
});
