import { UserSignedUpEvent } from 'src/auth/events/user-signed-up.event';
import {
    EnvelopesIngestedEvent,
    PluginActivatedEvent,
    PluginConfigUpdatedEvent,
    PluginDeactivatedEvent,
} from 'src/ingestion/events/ingestion.events';
import {
    IntelligenceJobCompletedEvent,
    IntelligenceJobFailedEvent,
    IntelligenceJobMessageEvent,
    IntelligenceJobSetDescriptionEvent,
    IntelligenceJobSetProgressableEvent,
    IntelligenceJobSetProgressEvent,
    IntelligenceJobSetTitleEvent,
    IntelligenceJobStartedEvent,
} from 'src/jobs/events/intelligence-job.events';

export class EmbeddingsBatchEvent {
    constructor(
        public readonly items: Array<{
            versionId: string;
            content: string;
        }>,
    ) {}
}

export const Events = {
    USER_SIGNED_UP: 'user.signed.up',
    ENVELOPES_INGESTED: 'envelopes.ingested',
    INSIGHT_VERSIONS_CREATED: 'insight.versions.created',
    EMBEDDINGS_GENERATE: 'embeddings.generate',
    PLUGIN_ACTIVATED: 'plugin.activated',
    PLUGIN_DEACTIVATED: 'plugin.deactivated',
    PLUGIN_CONFIG_UPDATED: 'plugin.config.updated',
    JOB_INTELLIGENCE_STARTED: 'job.intelligence.started',
    JOB_INTELLIGENCE_SET_TITLE: 'job.intelligence.setTitle',
    JOB_INTELLIGENCE_SET_DESCRIPTION: 'job.intelligence.setDescription',
    JOB_INTELLIGENCE_SET_PROGRESSABLE: 'job.intelligence.setProgressable',
    JOB_INTELLIGENCE_SET_PROGRESS: 'job.intelligence.setProgress',
    JOB_INTELLIGENCE_MESSAGE: 'job.intelligence.message',
    JOB_INTELLIGENCE_COMPLETED: 'job.intelligence.completed',
    JOB_INTELLIGENCE_FAILED: 'job.intelligence.failed',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface EventMap {
    [Events.USER_SIGNED_UP]: UserSignedUpEvent;
    [Events.ENVELOPES_INGESTED]: EnvelopesIngestedEvent;
    [Events.INSIGHT_VERSIONS_CREATED]: EmbeddingsBatchEvent;
    [Events.EMBEDDINGS_GENERATE]: EmbeddingsBatchEvent;
    [Events.PLUGIN_ACTIVATED]: PluginActivatedEvent;
    [Events.PLUGIN_DEACTIVATED]: PluginDeactivatedEvent;
    [Events.PLUGIN_CONFIG_UPDATED]: PluginConfigUpdatedEvent;
    [Events.JOB_INTELLIGENCE_STARTED]: IntelligenceJobStartedEvent;
    [Events.JOB_INTELLIGENCE_SET_TITLE]: IntelligenceJobSetTitleEvent;
    [Events.JOB_INTELLIGENCE_SET_DESCRIPTION]: IntelligenceJobSetDescriptionEvent;
    [Events.JOB_INTELLIGENCE_SET_PROGRESSABLE]: IntelligenceJobSetProgressableEvent;
    [Events.JOB_INTELLIGENCE_SET_PROGRESS]: IntelligenceJobSetProgressEvent;
    [Events.JOB_INTELLIGENCE_MESSAGE]: IntelligenceJobMessageEvent;
    [Events.JOB_INTELLIGENCE_COMPLETED]: IntelligenceJobCompletedEvent;
    [Events.JOB_INTELLIGENCE_FAILED]: IntelligenceJobFailedEvent;
}
