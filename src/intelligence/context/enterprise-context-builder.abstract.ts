import { EnterpriseContext } from './enterprise-context.types';

export abstract class EnterpriseContextBuilder {
    abstract build(
        organizationId: string,
        options?: {
            minMessages?: number;
            envelopeIds?: string[];
            windowStart?: Date;
            windowEnd?: Date;
        },
    ): AsyncIterable<EnterpriseContext>;
}
