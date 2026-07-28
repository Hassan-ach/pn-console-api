import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import {
    BackfillJobStartedEvent,
    BackfillJobProgressEvent,
    BackfillJobCompletedEvent,
    BackfillJobFailedEvent,
} from '../events/backfill-job.events';
import { EnvelopesIngestedEvent } from '../../intelligence/triggers/envelopes-ingested.event';

export interface ChatBackfillResult {
    chatId: string;
    chatName: string;
    inserted: number;
    error: string | null;
}

export interface BackfillPluginOpts {
    userId: string;
    organizationId: string;
    chats: { chatId: string; limit: number; chatName: string }[];
}

@Injectable()
export class IngestionRunnerService {
    private readonly logger = new Logger(IngestionRunnerService.name);

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async backfillPlugin(
        pluginName: string,
        opts: BackfillPluginOpts,
    ): Promise<{ chatResults: ChatBackfillResult[] }> {
        const results = await Promise.allSettled(
            opts.chats.map((chat) =>
                this.backfillSingleChat(
                    pluginName,
                    chat.chatId,
                    chat.chatName,
                    {
                        limit: chat.limit,
                        userId: opts.userId,
                        organizationId: opts.organizationId,
                    },
                ),
            ),
        );

        const chatResults: ChatBackfillResult[] = results.map((r, i) => {
            const chat = opts.chats[i];
            if (r.status === 'fulfilled') return r.value;
            return {
                chatId: chat.chatId,
                chatName: chat.chatName,
                inserted: 0,
                error: (r.reason as Error)?.message ?? 'Unknown error',
            };
        });

        return { chatResults };
    }

    async backfillSingleChat(
        pluginName: string,
        chatId: string,
        chatName: string,
        opts: { limit: number; userId: string; organizationId: string },
    ): Promise<ChatBackfillResult> {
        let jobId: string | undefined;

        if (opts.userId) {
            const results = await this.eventEmitter.emitAsync(
                'job.backfill.started',
                new BackfillJobStartedEvent(
                    opts.organizationId,
                    opts.userId,
                    `Backfill: ${pluginName} / ${chatName}`,
                    `Backfilling ${pluginName} chat "${chatName}"`,
                ),
            );
            jobId = (results?.[0] as { jobId?: string })?.jobId;
        }

        try {
            let totalFetched = 0;
            for await (const result of this.pluginManager.backfill(pluginName, {
                limit: opts.limit,
                userId: opts.userId,
                chatId,
            })) {
                totalFetched += result.inserted;

                if (jobId) {
                    const progress =
                        opts.limit > 0
                            ? Math.min(
                                  Math.round((totalFetched / opts.limit) * 100),
                                  100,
                              )
                            : undefined;
                    this.eventEmitter.emit(
                        'job.backfill.progress',
                        new BackfillJobProgressEvent(
                            jobId,
                            progress ?? 50,
                            `${totalFetched} messages fetched`,
                        ),
                    );
                }
            }

            if (jobId) {
                this.eventEmitter.emit(
                    'job.backfill.completed',
                    new BackfillJobCompletedEvent(
                        jobId,
                        `Backfilled ${totalFetched} messages`,
                    ),
                );
            }

            if (totalFetched > 0) {
                this.eventEmitter.emit(
                    'envelopes.ingested',
                    new EnvelopesIngestedEvent(
                        opts.organizationId,
                        totalFetched,
                        'backfill',
                        opts.userId,
                        undefined,
                        undefined,
                        undefined,
                    ),
                );
            }

            return { chatId, chatName, inserted: totalFetched, error: null };
        } catch (err) {
            if (jobId) {
                this.eventEmitter.emit(
                    'job.backfill.failed',
                    new BackfillJobFailedEvent(
                        jobId,
                        err instanceof Error ? err.message : 'Unknown error',
                    ),
                );
            }
            return {
                chatId,
                chatName,
                inserted: 0,
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }
}
