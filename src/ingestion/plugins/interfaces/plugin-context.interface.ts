import type { EnvelopeWithPayload } from '../../../types/envelope.types';

export interface StoreResult {
    inserted: number;
    ids: string[];
}

export interface PluginLogger {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
}

export interface PluginContext {
    getConfig(
        userId: string,
        pluginName: string,
    ): Promise<Record<string, unknown> | null>;
    saveConfig(
        userId: string,
        pluginName: string,
        config: Record<string, unknown>,
    ): Promise<void>;
    updateConfig(
        userId: string,
        pluginName: string,
        partial: Record<string, unknown>,
    ): Promise<void>;
    storeUserMapping(
        userId: string,
        pluginName: string,
        data: {
            platformUserId: string;
            platformUsername: string;
        },
    ): Promise<void>;

    storeEnvelopes(
        items: EnvelopeWithPayload[],
        userId: string,
    ): Promise<StoreResult>;

    getCursor(
        pluginName: string,
        userId: string,
        key: string,
    ): Promise<number | null>;
    saveCursor(
        pluginName: string,
        userId: string,
        key: string,
        value: number,
    ): Promise<void>;

    resolveOrgId(userId: string): string;
    logger: PluginLogger;
}
