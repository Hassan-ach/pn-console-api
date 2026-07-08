import { Injectable, Logger } from '@nestjs/common';
import { PluginManagerService } from './plugins/plugin-manager.service';
import { EnvelopeService } from '../envelope/envelope.service';

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly envelopeService: EnvelopeService,
    ) {}

    async ingest(
        pluginName: string,
        limit: number,
    ): Promise<{ inserted: number }> {
        const plugin = this.pluginManager.get(pluginName);
        if (!plugin) throw new Error(`Plugin "${pluginName}" not found`);

        let totalInserted = 0;
        for await (const chunk of plugin.backfill(limit)) {
            const dto = chunk.map((item) => ({
                envelope: item.envelope,
                payload: item.payload,
            }));
            const result = await this.envelopeService.bulkCreate(dto);
            totalInserted += result.inserted;
        }

        this.logger.log(
            `Ingest from "${pluginName}" complete: ${totalInserted} inserted`,
        );
        return { inserted: totalInserted };
    }
}
