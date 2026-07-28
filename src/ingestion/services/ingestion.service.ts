import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IngestionRunnerService } from './ingestion-runner.service';
import { EnvelopesIngestedEvent } from '../../intelligence/triggers/envelopes-ingested.event';

export interface IngestError {
    plugin: string;
    message: string;
}

export interface ChatBackfill {
    chatId: string;
    chatName: string;
    limit: number;
}

export interface PluginBackfill {
    name: string;
    chats: ChatBackfill[];
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
        private readonly ingestionRunner: IngestionRunnerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async ingest(
        options: IngestOptions,
    ): Promise<{ inserted: number; errors: IngestError[] }> {
        const startedAt = Date.now();
        let totalInserted = 0;
        const errors: IngestError[] = [];

        for (const plugin of options.plugins) {
            const { name, chats } = plugin;
            try {
                const result = await this.ingestionRunner.backfillPlugin(name, {
                    userId: options.userId,
                    organizationId: options.organizationId,
                    chats: chats.map((c) => ({
                        chatId: c.chatId,
                        chatName: c.chatName,
                        limit: c.limit,
                    })),
                });

                for (const cr of result.chatResults) {
                    totalInserted += cr.inserted;
                    if (cr.error) {
                        errors.push({
                            plugin: `${name}/${cr.chatName}`,
                            message: cr.error,
                        });
                    }
                }
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : 'Unknown error';
                errors.push({ plugin: name, message: msg });
            }
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

        this.logger.log(
            `Ingest complete: ${totalInserted} inserted, ${errors.length} error(s) in ${Date.now() - startedAt}ms`,
        );
        return { inserted: totalInserted, errors };
    }
}
