import { Injectable, Logger } from '@nestjs/common';
import { PluginConfigRepository } from 'src/repositories/plugin-config.repository';
import { EnvelopeRepository } from 'src/repositories/envelope.repository';
import type { EnvelopeWithPayload } from 'src/types/envelope.types';
import type {
    PluginContext,
    PluginLogger,
    StoreResult,
} from './interfaces/plugin-context.interface';

@Injectable()
export class PluginContextService implements PluginContext {
    readonly logger: PluginLogger = {
        info: (msg, ctx?) => this.nestLogger.log(msg),
        warn: (msg, ctx?) => this.nestLogger.warn(msg),
        error: (msg, ctx?) => this.nestLogger.error(msg),
        debug: (msg, ctx?) => this.nestLogger.debug(msg),
    };

    private readonly nestLogger = new Logger('PluginContext');

    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly envelopeRepo: EnvelopeRepository,
    ) {}

    async getConfig(
        userId: string,
        pluginName: string,
    ): Promise<Record<string, unknown> | null> {
        const row = await this.configRepo.findUnique(userId, pluginName);
        return row?.config ?? null;
    }

    async saveConfig(
        userId: string,
        pluginName: string,
        config: Record<string, unknown>,
    ): Promise<void> {
        await this.configRepo.upsert({ userId, pluginName, config });
    }

    async updateConfig(
        userId: string,
        pluginName: string,
        partial: Record<string, unknown>,
    ): Promise<void> {
        await this.configRepo.update(userId, pluginName, { config: partial });
    }

    async storeEnvelopes(
        items: EnvelopeWithPayload[],
        userId: string,
    ): Promise<StoreResult> {
        const orgId = this.resolveOrgId(userId);
        const inputs = items.map((item) => ({
            envelope: {
                sourcePlugin: item.envelope.sourcePlugin,
                sourceId: item.envelope.sourceId,
                type: item.envelope.type as string,
                hasAttachment: item.envelope.hasAttachment,
                authorId: item.envelope.authorId,
                organizationId: item.envelope.organizationId ?? orgId,
                status: item.envelope.status ?? 'PENDING',
                permissions: item.envelope.permissions,
                occurredAt: item.envelope.occurredAt,
            },
            payload: item.payload,
        }));
        return this.envelopeRepo.createManyWithPayload(inputs);
    }

    private resolveOrgId(_userId: string): string {
        return 'org-1';
    }
}
