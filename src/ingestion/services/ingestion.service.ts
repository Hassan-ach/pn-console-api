import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import { EnvelopesIngestedEvent } from '../../intelligence/triggers/envelopes-ingested.event';

export interface IngestError {
    plugin: string;
    message: string;
}
export interface PluginBackfill {
    name: string;
    limit: number;
}
export interface IngestOptions {
    plugins: PluginBackfill[];
    userId: string;
    organizationId: string;
    triggeredBy?: string;
}

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async ingest(
        options: IngestOptions,
    ): Promise<{ inserted: number; errors: IngestError[] }> {
        const startedAt = Date.now();

        this.logger.log(
            `Backfill starting: plugins=${options.plugins.map((p) => `${p.name}:${p.limit}`).join(', ')}, org=${options.organizationId}`,
        );

        let totalInserted = 0;
        const errors: IngestError[] = [];

        for (const plugin of options.plugins) {
            const { name, limit } = plugin;
            this.logger.log(
                `Plugin "${name}" backfill starting (limit=${limit})`,
            );

            try {
                for await (const result of this.pluginManager.backfill(name, {
                    limit,
                    userId: options.userId,
                    chatId: '', // ponytail: old per-plugin path lacks chatId; replaced by IngestionRunnerService
                })) {
                    totalInserted += result.inserted;
                    this.logger.debug(
                        `Plugin "${name}": inserted ${result.inserted} envelopes in chunk`,
                    );
                }
                this.logger.log(`Plugin "${name}" backfill complete`);
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : 'Unknown error';
                this.logger.error(`Plugin "${name}" backfill failed: ${msg}`);
                errors.push({ plugin: name, message: msg });
            }

            this.eventEmitter.emit(
                'envelopes.ingested',
                new EnvelopesIngestedEvent(
                    options.organizationId,
                    totalInserted,
                    'backfill',
                    options.userId,
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
