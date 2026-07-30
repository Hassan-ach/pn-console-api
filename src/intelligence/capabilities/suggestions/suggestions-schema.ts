import z from 'zod';

export const OptionSchema = z.object({
    label: z.string(),
    title: z.string(),
    description: z.string().optional(),
    actionType: z
        .enum([
            'RECOMMENDATION',
            'RISK_MITIGATION',
            'NEXT_STEP',
            'REASSIGN',
            'ESCALATE',
            'DELEGATE',
            'DISMISS',
        ])
        .default('RECOMMENDATION'),
    risk: z.string().optional(),
    reasoning: z.string().optional(),
});

export const SuggestionItemSchema = z.object({
    insightId: z.string(),
    title: z.string(),
    contextSummary: z.array(z.string()).default([]),
    options: z.array(OptionSchema).default([]),
});

export const SuggestionsResultSchema = z.object({
    suggestions: z.array(SuggestionItemSchema),
});

export type OptionItem = z.infer<typeof OptionSchema>;
export type SuggestionItem = z.infer<typeof SuggestionItemSchema>;
export type SuggestionsResult = z.infer<typeof SuggestionsResultSchema>;
