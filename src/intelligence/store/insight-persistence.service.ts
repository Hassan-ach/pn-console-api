import { Injectable } from '@nestjs/common';
import { InsightRepository } from 'src/repositories/insight.repository';
import { Insight } from 'src/types/insight.types';

@Injectable()
export class InsightPersistenceService {
  constructor(private readonly repo: InsightRepository) {}

  async persistAll(
    insights: Insight[],
    organizationId: string,
  ): Promise<void> {
    if (insights.length === 0) return;

    await Promise.all(
      insights.map((insight) => {
        if (insight.id === null) {
          return this.repo.create({
            organizationId,
            type: insight.type,
            content: insight.content,
            owners: insight.owners,
            envolopsRef: insight.envolopsRef,
            broadcasted: insight.broadcasted,
          });
        }

        return this.repo.update(insight.id, {
          type: insight.type,
          content: insight.content,
          owners: insight.owners,
          envolopsRef: insight.envolopsRef,
          broadcasted: insight.broadcasted,
        });
      }),
    );
  }

  async persist(insight: Insight, organizationId: string): Promise<void> {
    return this.persistAll([insight], organizationId);
  }
}
