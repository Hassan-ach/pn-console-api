import z from 'zod'

const InsightTypeSchema = z.enum(['TASK', 'URGENCY', 'INFO', 'DECISION'])

export const UpdatedInsightSchema = z.object({
  id: z.number(),
  type: InsightTypeSchema,
  content: z.string(),
})

export const NewInsightSchema = z.object({
  type: InsightTypeSchema,
  content: z.string(),
})

export const InsightResultSchema = z.object({
  updatedInsights: z.array(UpdatedInsightSchema),
  newInsights: z.array(NewInsightSchema),
})

export type InsightExtractionResult = z.infer<typeof InsightResultSchema>
