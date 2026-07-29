import type { ConfigService } from '@nestjs/config';
import type { ProviderChatEntry } from '../interfaces/provider-config.interface';

export function extractProviderChats(
    config: Record<string, unknown> | null | undefined,
): ProviderChatEntry[] {
    if (!config || !Array.isArray(config.chats)) return [];
    return config.chats.map((c: unknown) => {
        const chatObj = (
            typeof c === 'object' && c !== null ? c : {}
        ) as Record<string, unknown>;
        return {
            id: String(chatObj.id ?? ''),
            name: String(chatObj.name ?? ''),
            historyLimit:
                typeof chatObj.historyLimit === 'number'
                    ? chatObj.historyLimit
                    : undefined,
        };
    });
}

export function isSessionExpired(err: Error): boolean {
    const msg = err.message;
    return (
        msg.includes('AUTH_KEY_UNREGISTERED') ||
        msg.includes('SESSION_REVOKED') ||
        msg.includes('USER_DEACTIVATED') ||
        msg.includes('SESSION_EXPIRED')
    );
}

export function maskSecret(secret?: string): string | undefined {
    if (!secret) return undefined;
    if (secret.length <= 8) return '********';
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function resolvePluginConfig<T>(
    configService: ConfigService,
    pluginName: string,
    key: string,
    defaultValue: T,
    aliasKey?: string,
): T {
    const custom = configService.get<T>(`${pluginName}.${key}`);
    if (custom !== undefined && custom !== null) {
        return custom;
    }

    if (aliasKey) {
        const aliasCustom = configService.get<T>(`${pluginName}.${aliasKey}`);
        if (aliasCustom !== undefined && aliasCustom !== null) {
            return aliasCustom;
        }
    }

    const globalVal = configService.get<T>(`ingestion.${key}`);
    if (globalVal !== undefined && globalVal !== null) {
        return globalVal;
    }
    if (aliasKey) {
        const globalAlias = configService.get<T>(`ingestion.${aliasKey}`);
        if (globalAlias !== undefined && globalAlias !== null) {
            return globalAlias;
        }
    }

    return defaultValue;
}
