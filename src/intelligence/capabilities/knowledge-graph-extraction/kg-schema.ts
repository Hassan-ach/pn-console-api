import { z } from 'zod';

export const NodeSchema = z.object({
    name: z
        .string()
        .describe(
            'Name of the entity (e.g., Elon Musk, Alice, SpaceX, pn-console-api, DevOps Team)',
        ),
    type: z
        .string()
        .describe(
            'Label or type of entity (Person, Team, Project, Service, Repository, Document, Ticket, Channel)',
        ),
    role: z
        .string()
        .optional()
        .describe(
            'Organizational role or job title for Person/Team entities (e.g., DevOps Lead, Backend Engineer, Product Owner)',
        ),
});

export const RelationshipSchema = z.object({
    sourceName: z.string().describe('Exact name of the source entity node'),
    targetName: z.string().describe('Exact name of the target entity node'),
    type: z
        .string()
        .describe(
            'Type of relationship in UPPERCASE (e.g., WORKS_ON, OWNS, DEPENDS_ON, REFERENCES, BELONGS_TO, MENTIONS)',
        ),
});

export const KnowledgeGraphSchema = z.object({
    nodes: z.array(NodeSchema).describe('List of extracted entity nodes'),
    relationships: z
        .array(RelationshipSchema)
        .describe('List of extracted relationships between nodes'),
});

export type KnowledgeGraphData = z.infer<typeof KnowledgeGraphSchema>;
