import { PluginConfigData } from 'src/repositories/plugin-config.repository';

export class PluginActivatedEvent {
    constructor(
        public readonly userId: string,
        public readonly pluginName: string,
        public readonly config: PluginConfigData,
    ) {}
}

export class PluginDeactivatedEvent {
    constructor(
        public readonly userId: string,
        public readonly pluginName: string,
        public readonly config: PluginConfigData,
    ) {}
}

export class PluginConfigUpdatedEvent {
    constructor(
        public readonly userId: string,
        public readonly pluginName: string,
        public readonly config: PluginConfigData,
    ) {}
}

export class EnvelopesIngestedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly userId: string,
        public readonly pluginName: string,
        public readonly chatId: string,
        public readonly envelopeIds: string[],
        public readonly isBackfill: boolean,
    ) {}
}
