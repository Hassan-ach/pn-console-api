import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import { IngestionRunnerService } from '../services/ingestion-runner.service';
import { StreamingResumeService } from './streaming-resume.service';
import { RawDbService } from '../../prisma/raw-db/raw-db.service';
import type { EnvelopeWithPayload } from '../../types/envelope.types';

export type StreamChatStatus =
    'IDLE' | 'BACKFILLING' | 'LISTENING' | 'STOPPED' | 'ERROR';

export interface StreamState {
    pluginName: string;
    chatId: string;
    chatName: string;
    status: StreamChatStatus;
    lastMessageAt?: Date;
    abortController?: AbortController;
}

export class StreamBatchReadyEvent {
    constructor(
        public readonly pluginName: string,
        public readonly userId: string,
        public readonly organizationId: string,
        public readonly chatId: string,
        public readonly envelopes: EnvelopeWithPayload[],
        public readonly lastMessageId: number,
    ) {}
}

@Injectable()
export class StreamingOrchestratorService {
    private readonly logger = new Logger(StreamingOrchestratorService.name);
    private streams = new Map<string, StreamState>();

    constructor(
        private readonly pluginManager: PluginManagerService,
        private readonly ingestionRunner: IngestionRunnerService,
        private readonly resumeService: StreamingResumeService,
        private readonly rawDb: RawDbService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    startStream(
        pluginName: string,
        chatId: string,
        chatName: string,
        limit: number,
        userId: string,
        organizationId: string,
    ): void {
        const key = this.streamKey(pluginName, userId, chatId);
        const existing = this.streams.get(key);

        if (
            existing &&
            (existing.status === 'BACKFILLING' ||
                existing.status === 'LISTENING')
        ) {
            throw new ConflictException(
                `Stream already active for chat ${chatName}`,
            );
        }

        const state: StreamState = {
            pluginName,
            chatId,
            chatName,
            status: 'BACKFILLING',
        };
        this.streams.set(key, state);

        this.runStream(
            key,
            state,
            pluginName,
            chatId,
            chatName,
            limit,
            userId,
            organizationId,
        ).catch((err) => {
            this.logger.error(
                `Stream ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            state.status = 'ERROR';
        });
    }

    stopStream(pluginName: string, chatId: string, userId: string): void {
        const key = this.streamKey(pluginName, userId, chatId);
        const state = this.streams.get(key);
        if (!state) return;

        if (state.status === 'LISTENING' && state.abortController) {
            try {
                const plugin = this.pluginManager.get(pluginName);
                if (plugin?.stopStream) {
                    plugin.stopStream({ userId, chatId });
                }
            } catch (err) {
                this.logger.warn(
                    `Error stopping plugin stream: ${(err as Error).message}`,
                );
            }
            state.abortController.abort();
        }

        state.status = 'STOPPED';
        state.abortController = undefined;
    }

    async getStatus(
        pluginName: string,
        userId: string,
        configuredChats: { id: string; name: string }[],
    ): Promise<{
        streams: {
            chatId: string;
            chatName: string;
            status: string;
            lastMessageAt?: string;
        }[];
    }> {
        const results: {
            chatId: string;
            chatName: string;
            status: string;
            lastMessageAt?: string;
        }[] = [];

        for (const chat of configuredChats) {
            const key = this.streamKey(pluginName, userId, chat.id);
            const state = this.streams.get(key);

            if (state) {
                results.push({
                    chatId: chat.id,
                    chatName: chat.name,
                    status: state.status,
                    lastMessageAt: state.lastMessageAt?.toISOString(),
                });
            } else {
                const cursor = await this.rawDb.pluginCursor.findUnique({
                    where: {
                        pluginName_userId_key: {
                            pluginName,
                            userId,
                            key: chat.id,
                        },
                    },
                });
                results.push({
                    chatId: chat.id,
                    chatName: chat.name,
                    status: cursor ? 'stopped' : 'idle',
                });
            }
        }

        return { streams: results };
    }

    private async runStream(
        key: string,
        state: StreamState,
        pluginName: string,
        chatId: string,
        chatName: string,
        limit: number,
        userId: string,
        organizationId: string,
    ): Promise<void> {
        const strategy = await this.resumeService.resolve(
            pluginName,
            userId,
            chatId,
            limit,
        );

        const backfillLimit = strategy.type === 'gap' ? 10_000 : limit;
        const backfillResult = await this.ingestionRunner.backfillSingleChat(
            pluginName,
            chatId,
            chatName,
            { limit: backfillLimit, userId, organizationId },
        );

        if (backfillResult.error) {
            state.status = 'ERROR';
            return;
        }

        if (state.status !== 'BACKFILLING') {
            return;
        }

        state.status = 'LISTENING';
        state.abortController = new AbortController();

        try {
            const plugin = this.pluginManager.get(pluginName);
            if (!plugin?.startStream) {
                throw new Error(
                    `Plugin ${pluginName} does not support streaming`,
                );
            }

            const context = this.pluginManager.getContext();
            const stream = plugin.startStream(
                { userId, chatId },
                context,
                state.abortController.signal,
            );

            for await (const batch of stream) {
                if (batch.envelopes.length === 0) continue;

                state.lastMessageAt = new Date();

                this.eventEmitter.emit(
                    'stream.batch.ready',
                    new StreamBatchReadyEvent(
                        pluginName,
                        userId,
                        organizationId,
                        chatId,
                        batch.envelopes,
                        batch.lastMessageId ?? 0,
                    ),
                );

                if (state.status !== 'LISTENING') break;
            }
        } catch (err) {
            this.logger.error(
                `Stream ${key} listening phase failed: ${(err as Error).message}`,
            );
            state.status = 'ERROR';
            return;
        }

        if (state.status === 'LISTENING') {
            state.status = 'STOPPED';
        }
    }

    private streamKey(
        pluginName: string,
        userId: string,
        chatId: string,
    ): string {
        return `${pluginName}:${userId}:${chatId}`;
    }
}
