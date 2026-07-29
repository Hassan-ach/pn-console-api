import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    IPlugin,
    BackFillOpts,
    PlatformUserInfo,
    ConfigFieldSchema,
    ActivationRequirementResult,
} from '../interfaces/plugin.interface';
import type {
    PluginContext,
    StoreResult,
} from '../interfaces/plugin-context.interface';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { PluginContextService } from './plugin-context.service';
import { PluginConfigService } from './plugin-config.service';

@Injectable()
export class PluginManagerService {
    private readonly logger = new Logger(PluginManagerService.name);
    private instances = new Map<string, IPlugin>();

    readonly context: PluginContext;

    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly configService: PluginConfigService,
        contextService: PluginContextService,
    ) {
        this.context = contextService;
    }

    register(plugin: IPlugin): void {
        if (this.instances.has(plugin.name)) {
            throw new ConflictException(
                `Plugin "${plugin.name}" is already registered`,
            );
        }
        this.instances.set(plugin.name, plugin);
        this.logger.log(`Plugin "${plugin.name}" registered`);
    }

    unregister(name: string): void {
        this.instances.delete(name);
    }

    get(name: string): IPlugin | undefined {
        return this.instances.get(name);
    }

    getContext(): PluginContext {
        return this.context;
    }

    getConfigSchema(name: string): ConfigFieldSchema[] {
        const plugin = this.getInstance(name);
        return plugin.getConfigSchema?.() ?? [];
    }

    async getActivationRequirements(
        name: string,
        userId: string,
    ): Promise<ActivationRequirementResult[]> {
        const plugin = this.getInstance(name);
        const config = await this.configRepo.findUnique(userId, name);
        const cfg = config?.config ?? {};
        const requirements = plugin.getActivationRequirements?.(cfg) ?? [];
        return requirements.map((r) => ({
            field: r.field,
            message: r.message,
            met: r.validate(cfg),
        }));
    }

    async *backfill(
        name: string,
        opts: BackFillOpts,
    ): AsyncIterable<StoreResult> {
        const plugin = this.getInstance(name);
        yield* plugin.backfill(opts, this.context);
    }

    async getState(
        name: string,
        userId: string,
    ): Promise<{
        initialized: boolean;
        hasSession: boolean;
        isConnected: boolean;
    } | null> {
        if (!this.instances.has(name)) return null;
        const config = await this.configRepo.findUnique(userId, name);
        if (!config)
            return {
                initialized: false,
                hasSession: false,
                isConnected: false,
            };
        const isConnected = await this.getInstance(name).isConnected(
            this.context,
            userId,
            { ...config.config, sessionString: config.sessionString },
        );
        return {
            initialized: true,
            hasSession: !!config.sessionString,
            isConnected: isConnected,
        };
    }

    async list(
        userId: string,
    ): Promise<
        Array<{ name: string; connected: boolean; hasConfig: boolean }>
    > {
        const configs = await this.configRepo.findMany({ userId: userId });
        const pluginNames = Array.from(this.instances.keys());

        return Promise.all(
            pluginNames.map(async (name) => {
                try {
                    const plugin = this.instances.get(name)!;
                    const dbConfig = configs.find((c) => c.pluginName === name);
                    const fullConfig = dbConfig
                        ? {
                              ...dbConfig.config,
                              sessionString: dbConfig.sessionString,
                          }
                        : undefined;
                    const connected = await plugin.isConnected(
                        this.context,
                        userId,
                        fullConfig,
                    );
                    return { name, connected, hasConfig: !!dbConfig };
                } catch {
                    return {
                        name,
                        connected: false,
                        hasConfig: !!configs.find((c) => c.pluginName === name),
                    };
                }
            }),
        );
    }

    async updateConfig(
        name: string,
        config: Record<string, unknown>,
        userId: string,
    ): Promise<void> {
        this.getInstance(name);
        await this.configService.updateConfig(name, config, userId);
    }

    async getConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        this.getInstance(name);
        return this.configService.getConfig(name, userId);
    }

    async createConfig(
        userId: string,
        pluginName: string,
        data: {
            organizationId: string;
            config: Record<string, unknown>;
            metadata?: Record<string, unknown>;
        },
    ): Promise<void> {
        await this.configService.createConfig(userId, pluginName, data);
    }

    async getSanitizedConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        return this.configService.getSanitizedConfig(name, userId);
    }

    async disconnect(name: string, userId: string): Promise<void> {
        this.getInstance(name);
        await this.configService.disconnect(name, userId);
    }

    async login(
        name: string,
        userId: string,
        config: Record<string, unknown>,
    ): Promise<PlatformUserInfo> {
        const plugin = this.getInstance(name);
        return this.configService.login(
            name,
            userId,
            config,
            (sessionStr) => plugin.validateAuth(sessionStr, this.context, userId),
            this.context,
        );
    }

    async deleteConfig(name: string, userId: string): Promise<void> {
        this.getInstance(name);
        await this.configService.deleteConfig(name, userId);
    }

    private getInstance(name: string): IPlugin {
        const plugin = this.instances.get(name);
        if (!plugin) throw new NotFoundException(`Plugin "${name}" not found`);
        return plugin;
    }
}
