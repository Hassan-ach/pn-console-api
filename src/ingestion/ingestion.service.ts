import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugins/plugin-manager.service';
import { IngestOptions } from './types/ingestion-options.type';
import { EnvelopesIngestedEvent } from '../intelligence/triggers/envelopes-ingested.event';

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async ingest(options: IngestOptions): Promise<{ inserted: number }> {
        const pluginNames =
            typeof options.plugins === 'string'
                ? [options.plugins]
                : options.plugins;

        const startedAt = Date.now();

        this.logger.log(
            `Backfill starting: plugins=${pluginNames.join(', ')}, limit=${options.limit}, org=${options.organizationId}`,
        );

        let totalInserted = 0;
        const allIds: string[] = [];

        for (const name of pluginNames) {
            this.logger.log(`Plugin "${name}" backfill starting`);

            for await (const result of this.pluginManager.backfill(name, {
                limit: options.limit,
                userId: options.organizationId,
            })) {
                totalInserted += result.inserted;
                allIds.push(...result.ids);
                this.logger.debug(
                    `Plugin "${name}": inserted ${result.inserted} envelopes in chunk`,
                );
            }

            this.logger.log(`Plugin "${name}" backfill complete`);

            this.eventEmitter.emit(
                'envelopes.ingested',
                new EnvelopesIngestedEvent(
                    options.organizationId,
                    totalInserted,
                    'backfill',
                    undefined,
                    undefined,
                    undefined,
                ),
            );
        }

        this.logger.log(
            `Ingest complete: ${totalInserted} inserted in ${Date.now() - startedAt}ms`,
        );
        return { inserted: totalInserted };
    }
}
