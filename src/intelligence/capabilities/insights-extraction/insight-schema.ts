import z from 'zod';
import { InsightBroadcastLevel, InsightType } from 'src/types/insight.types';

const InsightTypeSchema = z.enum(Object.values(InsightType));
const BroadcastLevelSchema = z.enum(Object.values(InsightBroadcastLevel));

const nullToUndefined = (v: unknown) => (v == null ? undefined : v);

const OwnerRefSchema = z.object({
    id: z.preprocess(nullToUndefined, z.string().optional()),
    username: z.preprocess(nullToUndefined, z.string().optional()),
});

const broadcastRefine = (
    val: { broadcastLevel?: string; broadcastTarget?: string },
    ctx: z.RefinementCtx,
): void => {
    if (
        (val.broadcastLevel === 'TEAM' || val.broadcastLevel === 'ROLE') &&
        !val.broadcastTarget?.trim()
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `broadcastTarget is required when broadcastLevel is ${val.broadcastLevel}`,
            path: ['broadcastTarget'],
        });
    }
};

export const UpdatedInsightSchema = z
    .object({
        id: z.string(),
        type: InsightTypeSchema,
        content: z.string(),
        owners: z.array(OwnerRefSchema),
        envolopsRef: z.array(z.string()),
        broadcasted: z.boolean(),
        broadcastLevel: z.preprocess(
            nullToUndefined,
            BroadcastLevelSchema.optional(),
        ),
        broadcastTarget: z.preprocess(nullToUndefined, z.string().optional()),
        excludeAuthor: z.preprocess(nullToUndefined, z.boolean().optional()),
        priority: z.number().int().min(1).max(10),
        deadline: z.string().nullable(),
    })
    .superRefine(broadcastRefine);

export const NewInsightSchema = z
    .object({
        type: InsightTypeSchema,
        content: z.string(),
        owners: z.array(OwnerRefSchema),
        envolopsRef: z.array(z.string()),
        broadcasted: z.boolean(),
        broadcastLevel: z.preprocess(
            nullToUndefined,
            BroadcastLevelSchema.optional(),
        ),
        broadcastTarget: z.preprocess(nullToUndefined, z.string().optional()),
        excludeAuthor: z.preprocess(nullToUndefined, z.boolean().optional()),
        priority: z.number().int().min(1).max(10),
        deadline: z.string().nullable(),
    })
    .superRefine(broadcastRefine);

export const InsightResultSchema = z.object({
    updatedInsights: z.array(UpdatedInsightSchema),
    newInsights: z.array(NewInsightSchema),
});

export type InsightExtractionResult = z.infer<typeof InsightResultSchema>;
export type OwnerRef = z.infer<typeof OwnerRefSchema>;
