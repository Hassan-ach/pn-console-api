export interface IngestOptions {
    plugins: string | string[];
    limit: number;
    userId: string;
    organizationId: string;
    triggeredBy?: string;
    metadata?: Record<string, unknown>;
}
