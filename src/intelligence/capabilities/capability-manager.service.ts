import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CAPABILITY } from './capability.token';
import { ICapability, CapabilityInput, CapabilityResult } from './capability.interface';

@Injectable()
export class CapabilityManager {
    private readonly logger = new Logger(CapabilityManager.name);

    constructor(
        @Inject(CAPABILITY)
        private readonly capabilities: ICapability[],
    ) {}

    getAll(): ICapability[] {
        return this.capabilities;
    }

    getByName(name: string): ICapability | undefined {
        return this.capabilities.find((c) => c.name === name);
    }

    async executeAll(input: CapabilityInput): Promise<{
        results: CapabilityResult[];
        errors: { capabilityName: string; error: string }[];
    }> {
        const names = this.capabilities.map((c) => c.name);
        this.logger.debug(`Executing ${this.capabilities.length} capabilities: ${names.join(', ')}`);

        const entries = this.capabilities.map((cap) => ({
            name: cap.name,
            promise: cap
                .execute(input)
                .then((r) => ({ ...r, capabilityName: cap.name })),
        }));

        const outcomes = await Promise.allSettled(
            entries.map((e) => e.promise),
        );

        const results: CapabilityResult[] = [];
        const errors: { capabilityName: string; error: string }[] = [];

        for (let i = 0; i < outcomes.length; i++) {
            const outcome = outcomes[i];
            if (outcome.status === 'fulfilled') {
                results.push(outcome.value);
                this.logger.debug(
                    `Capability ${entries[i].name}: ${outcome.value.insights.length} insights`,
                );
            } else {
                errors.push({
                    capabilityName: entries[i].name,
                    error:
                        outcome.reason instanceof Error
                            ? outcome.reason.message
                            : String(outcome.reason),
                });
                this.logger.warn(
                    `Capability ${entries[i].name} failed: ${errors[errors.length - 1].error}`,
                );
            }
        }

        return { results, errors };
    }

    async executeByName(
        name: string,
        input: CapabilityInput,
    ): Promise<CapabilityResult> {
        this.logger.debug(`Executing capability "${name}"`);
        const cap = this.getByName(name);
        if (!cap) {
            throw new NotFoundException(`Capability "${name}" not found`);
        }
        return cap.execute(input);
    }
}
