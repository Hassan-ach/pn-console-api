export class EnvelopesIngestedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly inserted: number,
        public readonly type: 'backfill' | 'stream',
        public readonly windowStart?: Date,
        public readonly windowEnd?: Date,
        public readonly envelopeIds?: string[],
    ) {}
}
