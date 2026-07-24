import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EnvelopesIngestedEvent } from './envelopes-ingested.event';
import { IntelligenceEngineService } from '../intelligence-engine.service';

@Injectable()
export class EnvelopesIngestedListener {
    private readonly logger = new Logger(EnvelopesIngestedListener.name);

    constructor(private readonly engine: IntelligenceEngineService) {}

    @OnEvent('envelopes.ingested')
    async handle(event: EnvelopesIngestedEvent) {
        if (event.inserted === 0) {
            this.logger.log(
                `Skipping intelligence: ${event.inserted} envelopes inserted`,
            );
            return;
        }

        this.logger.log(
            `Triggered by ${event.type}: ${event.inserted} envelopes in org=${event.organizationId}`,
        );

        try {
            const result = await this.engine.run(event.organizationId, {
                userId: event.userId,
                ...(event.envelopeIds?.length
                    ? { envelopeIds: event.envelopeIds }
                    : {}),
            });

            this.logger.log(
                `Intelligence complete: ${result.insightsPersisted} insights persisted`,
            );
        } catch (error) {
            this.logger.error(
                `Intelligence engine failed after ${event.type}: ${error instanceof Error ? error.message : error}`,
            );
        }
    }
}
