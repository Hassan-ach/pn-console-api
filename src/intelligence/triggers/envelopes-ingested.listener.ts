import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'src/common/providers/event-bus/events.registry';
import { EnvelopesIngestedEvent } from 'src/ingestion/events/ingestion.events';
import { IntelligenceEngineService } from '../intelligence-engine.service';

@Injectable()
export class EnvelopesIngestedListener {
    private readonly logger = new Logger(EnvelopesIngestedListener.name);

    constructor(private readonly engine: IntelligenceEngineService) {}

    @OnEvent(Events.ENVELOPES_INGESTED)
    async handle(event: EnvelopesIngestedEvent) {
        const count = event.envelopeIds?.length ?? 0;
        if (count === 0) {
            this.logger.log(
                `Skipping intelligence: 0 envelopes ingested in org=${event.organizationId}`,
            );
            return;
        }

        this.logger.log(
            `Triggered by envelopes.ingested: ${count} envelopes in org=${event.organizationId}`,
        );

        try {
            const result = await this.engine.run(event.organizationId, {
                userId: event.userId,
                envelopeIds: event.envelopeIds,
                progressable: event.isBackfill,
            });

            this.logger.log(
                `Intelligence complete: ${result.insightsPersisted} insights persisted`,
            );
        } catch (error) {
            this.logger.error(
                `Intelligence engine failed for org=${event.organizationId}: ${(error as Error).message}`,
                (error as Error).stack,
            );
        }
    }
}
