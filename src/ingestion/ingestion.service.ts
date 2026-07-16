import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugins/plugin-manager.service';
import { EnvelopeRepository } from '../repositories/envelope.repository';
import type { CreateEnvelopeInput } from '../repositories/envelope.repository';
import { IngestOptions } from './types/ingestion-options.type';
import { EnvelopesIngestedEvent } from '../intelligence/triggers/envelopes-ingested.event';

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly envelopeRepo: EnvelopeRepository,
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

        for (const name of pluginNames) {
            const plugin = this.pluginManager.get(name);
            if (!plugin) throw new Error(`Plugin "${name}" not found`);

            this.logger.log(`Plugin "${name}" backfill starting`);

            let pluginInserted = 0;
            const pluginEnvelopeIds: string[] = [];

            for await (const chunk of plugin.backfill(options.limit)) {
                const items: CreateEnvelopeInput[] = chunk.map((item) => ({
                    envelope: {
                        sourcePlugin: item.envelope.sourcePlugin,
                        sourceId: item.envelope.sourceId,
                        type: item.envelope.type,
                        hasAttachment: item.envelope.hasAttachment,
                        authorId: item.envelope.authorId,
                        organizationId:
                            item.envelope.organizationId ??
                            options.organizationId,
                        status: item.envelope.status ?? 'PENDING',
                        permissions: item.envelope.permissions,
                        occurredAt: item.envelope.occurredAt,
                    },
                    payload: item.payload,
                }));
                const result =
                    await this.envelopeRepo.createManyWithPayload(items);
                pluginInserted += result.inserted;
                totalInserted += result.inserted;
                pluginEnvelopeIds.push(...result.ids);
                this.logger.debug(
                    `Plugin "${name}": inserted ${result.inserted} envelopes in chunk`,
                );
            }

            this.logger.log(
                `Plugin "${name}" backfill complete: ${pluginInserted} inserted`,
            );

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
