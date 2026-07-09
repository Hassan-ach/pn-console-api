export interface IngestOptions {
    plugins: string | string[];
    limit: number;
    organizationId?: string;
    triggeredBy?: string;
    metadata?: Record<string, unknown>;
}
