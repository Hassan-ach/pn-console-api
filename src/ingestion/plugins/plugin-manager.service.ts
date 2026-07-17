import { Injectable, Logger } from '@nestjs/common';
import { IPlugin, PluginLoginResult } from './interfaces/plugin.interface';
import { PluginState } from './interfaces/plugin-state.enum';

interface PluginRecord {
    instance: IPlugin;
    state: PluginState;
}

@Injectable()
export class PluginManagerService {
    private readonly logger = new Logger(PluginManagerService.name);
    private plugins = new Map<string, PluginRecord>();

    register(plugin: IPlugin): void {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already registered`);
        }
        this.plugins.set(plugin.name, {
            instance: plugin,
            state: PluginState.CREATED,
        });
        this.logger.log(`Plugin "${plugin.name}" registered`);
    }

    unregister(name: string): void {
        this.plugins.delete(name);
    }

    get(name: string): IPlugin | undefined {
        return this.plugins.get(name)?.instance;
    }

    getState(name: string): PluginState | undefined {
        return this.plugins.get(name)?.state;
    }

    list(): Array<{ name: string; state: PluginState }> {
        return Array.from(this.plugins.entries()).map(([name, record]) => ({
            name,
            state: record.state,
        }));
    }

    async initPlugin(
        name: string,
        config: Record<string, unknown>,
    ): Promise<void> {
        const record = this.getRecord(name);
        this.assertState(record, PluginState.CREATED);
        try {
            await record.instance.initialize!(config);
            record.state = PluginState.INITIALIZED;
            this.logger.log(`Plugin "${name}" initialized`);
        } catch (error) {
            record.state = PluginState.ERROR;
            throw error;
        }
    }

    async loginPlugin(
        name: string,
        credentials: Record<string, unknown>,
    ): Promise<PluginLoginResult> {
        const record = this.getRecord(name);
        this.assertState(record, PluginState.INITIALIZED);
        try {
            const result = await record.instance.login!(credentials);
            if (result.status === 'ok') {
                record.state = PluginState.LOGGED_IN;
                this.logger.log(`Plugin "${name}" logged in`);
            }
            return result;
        } catch (error) {
            record.state = PluginState.ERROR;
            throw error;
        }
    }

    async logoutPlugin(name: string): Promise<void> {
        const record = this.getRecord(name);
        if (record.state === PluginState.CREATED) {
            throw new Error(`Plugin "${name}" is not logged in`);
        }
        try {
            await record.instance.logout!();
            record.state = PluginState.INITIALIZED;
            this.logger.log(`Plugin "${name}" logged out`);
        } catch (error) {
            record.state = PluginState.ERROR;
            throw error;
        }
    }

    async handleAction(
        name: string,
        action: string,
        params: Record<string, unknown>,
    ): Promise<unknown> {
        const record = this.getRecord(name);
        const result = (await record.instance.handleAction!(
            action,
            params,
        )) as Record<string, unknown> | null;

        if (
            action.startsWith('submit-') &&
            result?.status === 'ok' &&
            record.state === PluginState.INITIALIZED
        ) {
            record.state = PluginState.LOGGED_IN;
            this.logger.log(`Plugin "${name}" logged in (via ${action})`);
        }

        return result;
    }

    private getRecord(name: string): PluginRecord {
        const record = this.plugins.get(name);
        if (!record) throw new Error(`Plugin "${name}" not found`);
        return record;
    }

    private assertState(record: PluginRecord, expected: PluginState): void {
        if (record.state !== expected) {
            throw new Error(
                `Plugin "${record.instance.name}" is in state ${record.state}, expected ${expected}`,
            );
        }
    }
}
