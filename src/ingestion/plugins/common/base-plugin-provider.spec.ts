import { BasePluginProvider } from './base-plugin-provider';
import type {
    PluginContext,
    StoreResult,
} from '../interfaces/plugin-context.interface';
import type {
    BackFillOpts,
    StreamBatch,
    StreamOpts,
    PlatformUserInfo,
} from '../interfaces/plugin.interface';
import type { BaseProviderConfig } from '../interfaces/provider-config.interface';

class TestPlugin extends BasePluginProvider<BaseProviderConfig> {
    readonly name = 'test';

    async validateAuth(
        _sessionString: string,
        _context: PluginContext,
        _userId: string,
    ): Promise<PlatformUserInfo> {
        return { platformUserId: 'p1', platformUsername: 'test-user' };
    }

    async isConnected(
        _context: PluginContext,
        _userId: string,
    ): Promise<boolean> {
        return true;
    }

    async *backfill(
        _opts: BackFillOpts,
        _context: PluginContext,
        _signal?: AbortSignal,
    ): AsyncIterable<StoreResult> {
        yield { inserted: 0, ids: [] };
    }

    async *startStream(
        _opts: StreamOpts,
        _context: PluginContext,
        _signal?: AbortSignal,
    ): AsyncIterable<StreamBatch> {
        yield { envelopes: [], lastMessageId: 0 };
    }
}

describe('BasePluginProvider', () => {
    let plugin: TestPlugin;

    beforeEach(() => {
        plugin = new TestPlugin();
    });

    it('getConfigSchema returns empty array by default', () => {
        expect(plugin.getConfigSchema()).toEqual([]);
    });

    it('getActivationRequirements returns empty array by default', () => {
        expect(plugin.getActivationRequirements({})).toEqual([]);
    });

    it('parseConfig extracts chats from raw config', () => {
        const result = plugin.parseConfig({
            apiId: 12345,
            chats: [{ id: 'chat-1', name: 'General' }],
        });
        expect(result.chats).toEqual([
            { id: 'chat-1', name: 'General', historyLimit: undefined },
        ]);
    });

    it('parseConfig preserves extra fields', () => {
        const result = plugin.parseConfig({
            apiId: 12345,
            apiHash: 'abc123',
            sessionString: 'sess',
        });
        expect(result.apiId).toBe(12345);
        expect(result.apiHash).toBe('abc123');
    });

    it('parseConfig handles missing chats', () => {
        const result = plugin.parseConfig({ apiId: 1 });
        expect(result.chats).toEqual([]);
    });
});
