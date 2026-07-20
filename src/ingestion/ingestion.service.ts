import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugins/plugin-manager.service';
import { IngestOptions } from './types/ingestion-options.type';
import { EnvelopesIngestedEvent } from '../intelligence/triggers/envelopes-ingested.event';

export interface IngestError {
    plugin: string;
    message: string;
}

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async ingest(options: IngestOptions): Promise<{ inserted: number; errors: IngestError[] }> {
        const pluginNames =
            typeof options.plugins === 'string'
                ? [options.plugins]
                : options.plugins;

        const startedAt = Date.now();

        this.logger.log(
            `Backfill starting: plugins=${pluginNames.join(', ')}, limit=${options.limit}, org=${options.organizationId}`,
        );

        let totalInserted = 0;
        const errors: IngestError[] = [];

        for (const name of pluginNames) {
            this.logger.log(`Plugin "${name}" backfill starting`);

            try {
                for await (const result of this.pluginManager.backfill(name, {
                    limit: options.limit,
                    userId: options.organizationId,
                })) {
                    totalInserted += result.inserted;
                    this.logger.debug(
                        `Plugin "${name}": inserted ${result.inserted} envelopes in chunk`,
                    );
                }
                this.logger.log(`Plugin "${name}" backfill complete`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                this.logger.error(`Plugin "${name}" backfill failed: ${msg}`);
                errors.push({ plugin: name, message: msg });
            }

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
            `Ingest complete: ${totalInserted} inserted, ${errors.length} error(s) in ${Date.now() - startedAt}ms`,
        );
        return { inserted: totalInserted, errors };
    }
}
