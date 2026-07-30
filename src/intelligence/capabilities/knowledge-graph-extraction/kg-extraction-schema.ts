import { z } from 'zod';

export const ENTITY_TYPES = [
    'Person',
    'Team',
    'Project',
    'Service',
    'Repository',
    'Document',
    'Ticket',
    'Channel',
] as const;

export const RELATIONSHIP_TYPES = [
    'WORKS_ON',
    'OWNS',
    'DEPENDS_ON',
    'REFERENCES',
    'BELONGS_TO',
    'MENTIONS',
] as const;

export const ExtractedEntitySchema = z.object({
    name: z.string().min(1),
    type: z.enum(ENTITY_TYPES).or(z.string()),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const ExtractedRelationshipSchema = z.object({
    sourceEntityName: z.string().min(1),
    sourceEntityType: z.enum(ENTITY_TYPES).or(z.string()),
    targetEntityName: z.string().min(1),
    targetEntityType: z.enum(ENTITY_TYPES).or(z.string()),
    type: z.enum(RELATIONSHIP_TYPES).or(z.string()),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const KnowledgeGraphExtractionResultSchema = z.object({
    entities: z.array(ExtractedEntitySchema),
    relationships: z.array(ExtractedRelationshipSchema),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type ExtractedRelationship = z.infer<typeof ExtractedRelationshipSchema>;
export type KnowledgeGraphExtractionResult = z.infer<
    typeof KnowledgeGraphExtractionResultSchema
>;
