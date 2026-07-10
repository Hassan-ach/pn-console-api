import { Injectable, Logger } from '@nestjs/common';
import { InsightRepository } from 'src/repositories/insight.repository';
import { Insight } from 'src/types/insight.types';

@Injectable()
export class InsightPersistenceService {
    private readonly logger = new Logger(InsightPersistenceService.name);

    constructor(private readonly repo: InsightRepository) {}

    async persistAll(insights: Insight[]): Promise<void> {
        if (insights.length === 0) return;

        const newCount = insights.filter((i) => i.id === null).length;
        const updateCount = insights.filter((i) => i.id !== null).length;
        this.logger.log(`Persisting ${insights.length} insights (${newCount} new, ${updateCount} updates)`);

        await Promise.all(
            insights.map((insight) => {
                if (insight.id === null) {
                    return this.repo.create({
                        organizationId: insight.organizationId,
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

        this.logger.log(`Persistence complete: ${insights.length} insights`);
    }

    async persist(insight: Insight): Promise<void> {
        return this.persistAll([insight]);
    }
}
