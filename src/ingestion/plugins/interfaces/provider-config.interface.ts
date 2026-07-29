export interface ProviderChatEntry {
    id: string;
    name: string;
    historyLimit?: number;
}

export interface BaseProviderConfig {
    chats: ProviderChatEntry[];
    [key: string]: unknown;
}

export interface ConfigFieldSchema {
    key: string;
    label: string;
    type: 'text' | 'number' | 'password' | 'checkbox-list';
    required: boolean;
    placeholder?: string;
    description?: string;
}

export interface ActivationRequirementResult {
    field: string;
    message: string;
    met: boolean;
}

export { extractProviderChats } from '../utils/provider-utils';
