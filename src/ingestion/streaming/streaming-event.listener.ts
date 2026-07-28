import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IntelligenceEngineService } from '../../intelligence/intelligence-engine.service';
import { PluginManagerService } from '../plugins/services/plugin-manager.service';
import { CapabilityFailureRepository } from '../../repositories/capability-failure.repository';
import { StreamBatchReadyEvent } from './streaming-orchestrator.service';

@Injectable()
export class StreamingEventListener {
    private readonly logger = new Logger(StreamingEventListener.name);

    constructor(
        private readonly engine: IntelligenceEngineService,
        private readonly pluginManager: PluginManagerService,
        private readonly failureRepository: CapabilityFailureRepository,
    ) {}

    @OnEvent('stream.batch.ready')
    async handle(event: StreamBatchReadyEvent): Promise<void> {
        this.logger.debug(
            `Stream batch ready: plugin=${event.pluginName}, chat=${event.chatId}, ` +
                `envelopes=${event.envelopes.length}, lastMsgId=${event.lastMessageId}`,
        );

        const context = this.pluginManager.getContext();
        const storeResult = await context.storeEnvelopes(
            event.envelopes,
            event.userId,
        );

        if (storeResult.inserted === 0) {
            this.logger.warn(
                `Stream batch for chat ${event.chatId}: 0 new envelopes — ` +
                    `cursor will still advance to keep stream moving`,
            );
            await this.saveCursor(event, event.lastMessageId);
            return;
        }

        try {
            const result = await this.engine.run(event.organizationId, {
                userId: event.userId,
                envelopeIds: storeResult.ids,
                skipChunking: true,
                progressable: false,
            });

            this.logger.debug(
                `Stream batch intelligence complete for chat ${event.chatId}: ` +
                    `${result.insightsPersisted} insights from ${storeResult.inserted} envelopes`,
            );

            await this.saveCursor(event, event.lastMessageId);
        } catch (error) {
            const errMsg =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Stream batch intelligence failed for chat ${event.chatId}: ${errMsg}`,
            );

            await this.failureRepository.create({
                capabilityName: `streaming:${event.pluginName}`,
                chunkId: `stream-${event.chatId}-${event.lastMessageId}`,
                errorMessage: errMsg,
                envelopeIds: storeResult.ids,
                organizationId: event.organizationId,
            });
        }
    }

    private async saveCursor(
        event: StreamBatchReadyEvent,
        value: number,
    ): Promise<void> {
        const context = this.pluginManager.getContext();
        await context.saveCursor(
            event.pluginName,
            event.userId,
            event.chatId,
            value,
        );
    }
}
