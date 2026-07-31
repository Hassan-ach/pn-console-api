import { NewInsightSchema, InsightResultSchema } from './insight-schema';

describe('InsightResultSchema', () => {
    const baseInsight = {
        type: 'TASK',
        content: 'Refactor user-db service',
        owners: [],
        envolopsRef: [],
        broadcasted: false,
        priority: 8,
        deadline: null,
    };

    it('accepts null broadcastTarget and broadcastLevel', () => {
        const result = InsightResultSchema.parse({
            updatedInsights: [],
            newInsights: [
                {
                    ...baseInsight,
                    broadcastLevel: null,
                    broadcastTarget: null,
                },
            ],
        });

        expect(result.newInsights[0].broadcastLevel).toBeUndefined();
        expect(result.newInsights[0].broadcastTarget).toBeUndefined();
    });

    it('accepts null excludeAuthor', () => {
        const result = NewInsightSchema.parse({
            ...baseInsight,
            excludeAuthor: null,
        });

        expect(result.excludeAuthor).toBeUndefined();
    });

    it('accepts null owner id and username', () => {
        const result = NewInsightSchema.parse({
            ...baseInsight,
            owners: [{ id: null, username: null }],
        });

        expect(result.owners[0].id).toBeUndefined();
        expect(result.owners[0].username).toBeUndefined();
    });

    it('rejects TEAM broadcast without a broadcastTarget', () => {
        const parse = () =>
            NewInsightSchema.parse({
                ...baseInsight,
                broadcasted: false,
                broadcastLevel: 'TEAM',
                broadcastTarget: null,
            });

        expect(parse).toThrow(/broadcastTarget is required/);
    });

    it('accepts valid TEAM broadcast with a broadcastTarget', () => {
        const result = NewInsightSchema.parse({
            ...baseInsight,
            broadcastLevel: 'TEAM',
            broadcastTarget: 'Platform Team',
        });

        expect(result.broadcastTarget).toBe('Platform Team');
    });
});
