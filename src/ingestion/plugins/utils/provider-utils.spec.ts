import { ConfigService } from '@nestjs/config';
import {
    extractProviderChats,
    isSessionExpired,
    maskSecret,
    resolvePluginConfig,
} from './provider-utils';

describe('extractProviderChats', () => {
    it('returns [] for null/undefined/empty config', () => {
        expect(extractProviderChats(null)).toEqual([]);
        expect(extractProviderChats(undefined)).toEqual([]);
        expect(extractProviderChats({})).toEqual([]);
    });

    it('maps chat entries with all fields', () => {
        const result = extractProviderChats({
            chats: [
                { id: 'chat-1', name: 'General', historyLimit: 50 },
                { id: 'chat-2', name: 'Random' },
            ],
        });
        expect(result).toEqual([
            { id: 'chat-1', name: 'General', historyLimit: 50 },
            { id: 'chat-2', name: 'Random', historyLimit: undefined },
        ]);
    });

    it('coerces numeric ids to string', () => {
        const result = extractProviderChats({
            chats: [{ id: 12345, name: 'Numeric' }],
        });
        expect(result[0].id).toBe('12345');
    });

    it('handles malformed chat entries gracefully', () => {
        const result = extractProviderChats({
            chats: [null, 'string', { name: 'no-id' }],
        });
        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('');
        expect(result[2].id).toBe('');
        expect(result[2].name).toBe('no-id');
    });
});

describe('isSessionExpired', () => {
    it('detects AUTH_KEY_UNREGISTERED', () => {
        expect(isSessionExpired(new Error('AUTH_KEY_UNREGISTERED'))).toBe(true);
    });

    it('detects SESSION_REVOKED', () => {
        expect(isSessionExpired(new Error('SESSION_REVOKED'))).toBe(true);
    });

    it('detects USER_DEACTIVATED', () => {
        expect(isSessionExpired(new Error('USER_DEACTIVATED'))).toBe(true);
    });

    it('detects SESSION_EXPIRED', () => {
        expect(isSessionExpired(new Error('SESSION_EXPIRED'))).toBe(true);
    });

    it('returns false for other errors', () => {
        expect(isSessionExpired(new Error('NETWORK_ERROR'))).toBe(false);
        expect(isSessionExpired(new Error('TIMEOUT'))).toBe(false);
    });
});

describe('maskSecret', () => {
    it('returns undefined for empty input', () => {
        expect(maskSecret()).toBeUndefined();
        expect(maskSecret('')).toBeUndefined();
    });

    it('returns 8 asterisks for short secrets', () => {
        expect(maskSecret('abc')).toBe('********');
        expect(maskSecret('12345678')).toBe('********');
    });

    it('masks middle of long secrets', () => {
        expect(maskSecret('abcdefghijklmnop')).toBe('abcd...mnop');
    });
});

describe('resolvePluginConfig', () => {
    let configService: ConfigService;

    beforeEach(() => {
        configService = {
            get: jest.fn(),
        } as unknown as ConfigService;
    });

    it('returns plugin-specific value when set', () => {
        (configService.get as jest.Mock).mockImplementation(
            (_key: string) => undefined,
        );
        (configService.get as jest.Mock).mockImplementationOnce(
            () => 42,
        );
        const result = resolvePluginConfig(configService, 'telegram', 'batchSize', 10);
        expect(configService.get).toHaveBeenCalledWith('telegram.batchSize');
        expect(result).toBe(42);
    });

    it('falls back to ingestionscope key', () => {
        (configService.get as jest.Mock).mockImplementation(
            (_key: string) => undefined,
        );
        (configService.get as jest.Mock).mockImplementationOnce(() => undefined);
        (configService.get as jest.Mock).mockImplementationOnce(() => 99);
        const result = resolvePluginConfig(configService, 'telegram', 'batchSize', 10);
        expect(result).toBe(99);
    });

    it('returns default when nothing configured', () => {
        (configService.get as jest.Mock).mockReturnValue(undefined);
        const result = resolvePluginConfig(configService, 'telegram', 'batchSize', 10);
        expect(result).toBe(10);
    });
});
