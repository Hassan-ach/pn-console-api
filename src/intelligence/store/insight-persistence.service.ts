import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { Insight } from 'src/types/insight';

@Injectable()
export class InsightPersistenceService {
  constructor(private prisma: AppDbService) {}

  async persistAll(insights: Insight[]): Promise<void> {
    if (insights.length === 0) return;

    const newInsights = insights.filter((i) => i.id === null);
    const existingInsights = insights.filter(
      (i): i is Insight & { id: string } => i.id !== null,
    );

    await this.prisma.$transaction(async (tx) => {
      const createdForNew = await Promise.all(
        newInsights.map((insight) =>
          tx.insight.create({
            data: {
              versions: {
                create: {
                  version: 1,
                  type: insight.type,
                  content: insight.content,
                  owners: insight.owners,
                },
              },
            },
            select: { id: true },
          }),
        ),
      );
      void createdForNew;

      if (existingInsights.length > 0) {
        const existingIds = existingInsights.map((i) => i.id);

        await Promise.all(
          existingIds.map((id) =>
            tx.insight.update({
              where: { id },
              data: {}, // updatedAt bumps automatically via @updatedAt
            }),
          ),
        );

        const latestVersions = await tx.insightVersion.groupBy({
          by: ['insightId'],
          where: { insightId: { in: existingIds } },
          _max: { version: true },
        });

        const latestVersionMap = new Map<string, number>(
          latestVersions.map((v) => [v.insightId, v._max.version ?? 0]),
        );

        await tx.insightVersion.createMany({
          data: existingInsights.map((insight) => ({
            insightId: insight.id,
            version: (latestVersionMap.get(insight.id) ?? 0) + 1,
            type: insight.type,
            content: insight.content,
            owners: insight.owners,
          })),
        });
      }
    });
  }

  async persist(insight: Insight): Promise<void> {
    return this.persistAll([insight]);
  }
}
