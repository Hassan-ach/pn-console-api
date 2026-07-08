import { EnterpriseContext } from './enterprise-context.types';

export abstract class EnterpriseContextBuilder {
    abstract build(organizationId: string): EnterpriseContext;
}
