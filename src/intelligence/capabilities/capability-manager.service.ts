import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CAPABILITY } from './capability.token';
import { ICapability, CapabilityInput, CapabilityResult } from './capability.interface';

@Injectable()
export class CapabilityManager {
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
            } else {
                errors.push({
                    capabilityName: entries[i].name,
                    error:
                        outcome.reason instanceof Error
                            ? outcome.reason.message
                            : String(outcome.reason),
                });
            }
        }

        return { results, errors };
    }

    async executeByName(
        name: string,
        input: CapabilityInput,
    ): Promise<CapabilityResult> {
        const cap = this.getByName(name);
        if (!cap) {
            throw new NotFoundException(`Capability "${name}" not found`);
        }
        return cap.execute(input);
    }
}
