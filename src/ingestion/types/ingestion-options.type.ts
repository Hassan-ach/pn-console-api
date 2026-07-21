export interface PluginBackfill {
    name: string;
    limit: number;
}

export interface IngestOptions {
    plugins: PluginBackfill[];
    userId: string;
    organizationId: string;
    triggeredBy?: string;
    metadata?: Record<string, unknown>;
}
