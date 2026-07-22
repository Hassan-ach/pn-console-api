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
} from '../interfaces/plugin.interface';
import type {
    PluginContext,
    StoreResult,
} from '../interfaces/plugin-context.interface';
import { PluginConfigRepository } from '../../../repositories/plugin-config.repository';
import { PluginContextService } from './plugin-context.service';

@Injectable()
export class PluginManagerService {
    private readonly logger = new Logger(PluginManagerService.name);
    private instances = new Map<string, IPlugin>();

    readonly context: PluginContext;

    constructor(
        private readonly configRepo: PluginConfigRepository,
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
        if (!this.instances.has(name))
            throw new NotFoundException(`Plugin "${name}" not found`);
        await this.configRepo.update(userId, name, { config: config });
    }

    async getConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        if (!this.instances.has(name))
            throw new NotFoundException(`Plugin "${name}" not found`);
        const row = await this.configRepo.findUnique(userId, name);
        return row?.config ?? null;
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
        await this.configRepo.upsert(userId, pluginName, data);
    }

    async getSanitizedConfig(
        name: string,
        userId: string,
    ): Promise<Record<string, unknown> | null> {
        const config = await this.getConfig(name, userId);
        if (!config) return null;
        return { ...config };
    }

    async disconnect(name: string, userId: string): Promise<void> {
        if (!this.instances.has(name))
            throw new NotFoundException(`Plugin "${name}" not found`);
        await this.configRepo.clearSessionString(userId, name);
    }

    async login(
        name: string,
        userId: string,
        config: Record<string, unknown>,
    ): Promise<PlatformUserInfo> {
        const plugin = this.getInstance(name);

        const sessionString = config.sessionString as string | undefined;
        if (!sessionString) {
            throw new NotFoundException(`sessionString is required for login`);
        }
        const configJson = { ...config };
        delete configJson.sessionString;

        await this.configRepo.upsert(userId, name, {
            organizationId: this.context.resolveOrgId(userId),
            config: configJson,
        });

        const userInfo = await plugin.validateAuth(
            sessionString,
            this.context,
            userId,
        );

        await this.configRepo.updateSessionString(userId, name, sessionString);

        return userInfo;
    }

    async deleteConfig(name: string, userId: string): Promise<void> {
        if (!this.instances.has(name))
            throw new NotFoundException(`Plugin "${name}" not found`);
        await this.configRepo.remove(userId, name);
    }

    private getInstance(name: string): IPlugin {
        const plugin = this.instances.get(name);
        if (!plugin) throw new NotFoundException(`Plugin "${name}" not found`);
        return plugin;
    }
}
