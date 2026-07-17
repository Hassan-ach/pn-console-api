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
    logger: PluginLogger;
}
