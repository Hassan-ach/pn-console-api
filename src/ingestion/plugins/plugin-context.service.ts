import { Injectable, Logger } from '@nestjs/common';
import { PluginConfigRepository } from 'src/repositories/plugin-config.repository';
import type {
    PluginContext,
    PluginLogger,
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

    constructor(private readonly configRepo: PluginConfigRepository) {}

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
}
