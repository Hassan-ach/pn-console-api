export type InsightType = 'TASK' | 'URGENCY' | 'INFO' | 'DECISION';

export interface Insight {
  id: string | null;
  organizationId?: string;
  envolopsRef?: string[];
  broadcasted?: boolean;
  type: InsightType;
  content: string;
  owners: string[];
  version?: number;
  createdAt?: Date;
}
