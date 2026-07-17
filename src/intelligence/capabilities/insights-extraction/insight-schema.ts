import z from 'zod';
import { InsightType } from 'src/types/insight.types';

const InsightTypeSchema = z.enum(Object.values(InsightType));

const OwnerRefSchema = z.object({
    id: z.string().optional(),
    username: z.string().optional(),
});

export const UpdatedInsightSchema = z.object({
    id: z.string(),
    type: InsightTypeSchema,
    content: z.string(),
    owners: z.array(OwnerRefSchema),
    envolopsRef: z.array(z.string()),
    broadcasted: z.boolean(),
});

export const NewInsightSchema = z.object({
    type: InsightTypeSchema,
    content: z.string(),
    owners: z.array(OwnerRefSchema),
    envolopsRef: z.array(z.string()),
    broadcasted: z.boolean(),
});

export const InsightResultSchema = z.object({
    updatedInsights: z.array(UpdatedInsightSchema),
    newInsights: z.array(NewInsightSchema),
});

export type InsightExtractionResult = z.infer<typeof InsightResultSchema>;
export type OwnerRef = z.infer<typeof OwnerRefSchema>;
