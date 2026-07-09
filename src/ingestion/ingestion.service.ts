import { Injectable, Logger } from '@nestjs/common';
import { PluginManagerService } from './plugins/plugin-manager.service';
import { EnvelopeService } from '../envelope/envelope.service';
import { IngestOptions } from './types/ingestion-options.type';

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly envelopeService: EnvelopeService,
    ) {}

    async ingest(options: IngestOptions): Promise<{ inserted: number }> {
        const pluginNames =
            typeof options.plugins === 'string'
                ? [options.plugins]
                : options.plugins;

        let totalInserted = 0;

        for (const name of pluginNames) {
            const plugin = this.pluginManager.get(name);
            if (!plugin)
                throw new Error(`Plugin "${name}" not found`);

            for await (const chunk of plugin.backfill(options.limit)) {
                const dto = chunk.map((item) => ({
                    envelope: item.envelope,
                    payload: item.payload,
                }));
                const result = await this.envelopeService.bulkCreate(dto, {
                    organizationId: options.organizationId,
                });
                totalInserted += result.inserted;
            }
        }

        this.logger.log(
            `Ingest complete: ${totalInserted} inserted`,
            options,
        );
        return { inserted: totalInserted };
    }
}
