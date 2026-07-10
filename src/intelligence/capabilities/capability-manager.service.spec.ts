import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CapabilityManager } from './capability-manager.service';
import { CAPABILITY } from './capability.token';
import { ICapability, CapabilityInput } from './capability.interface';

describe('CapabilityManager', () => {
    const mockInput: CapabilityInput = {
        chunk: {
            id: 'test-chunk',
            envelopes: [],
            metadata: {
                timeRange: { start: new Date(), end: new Date() },
                envelopeCount: 0,
            },
        },
        previousIntelligence: [],
    };

    describe('registry', () => {
        const mockCapabilityA: ICapability = {
            name: 'capability-a',
            execute: jest.fn(),
        };

        const mockCapabilityB: ICapability = {
            name: 'capability-b',
            execute: jest.fn(),
        };

        let manager: CapabilityManager;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    {
                        provide: CAPABILITY,
                        useValue: [mockCapabilityA, mockCapabilityB],
                    },
                ],
            }).compile();

            manager = module.get(CapabilityManager);
        });

        it('returns all registered capabilities', () => {
            expect(manager.getAll()).toEqual([
                mockCapabilityA,
                mockCapabilityB,
            ]);
        });

        it('finds a capability by name', () => {
            expect(manager.getByName('capability-a')).toBe(mockCapabilityA);
            expect(manager.getByName('capability-b')).toBe(mockCapabilityB);
        });

        it('returns undefined for unknown name', () => {
            expect(manager.getByName('unknown')).toBeUndefined();
        });
    });

    describe('executeAll', () => {
        it('returns results from all capabilities', async () => {
            const capA: ICapability = {
                name: 'cap-a',
                execute: jest.fn().mockResolvedValue({
                    capabilityName: 'cap-a',
                    insights: [
                        { id: 'i1', type: 'TASK', content: 'a', owners: [] },
                    ],
                }),
            };
            const capB: ICapability = {
                name: 'cap-b',
                execute: jest.fn().mockResolvedValue({
                    capabilityName: 'cap-b',
                    insights: [
                        { id: 'i2', type: 'INFO', content: 'b', owners: [] },
                    ],
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [capA, capB] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);
            const { results, errors } = await manager.executeAll(mockInput);

            expect(results).toHaveLength(2);
            expect(errors).toHaveLength(0);
            expect(results[0].capabilityName).toBe('cap-a');
            expect(results[1].capabilityName).toBe('cap-b');
        });

        it('collects errors from failing capabilities', async () => {
            const capA: ICapability = {
                name: 'cap-a',
                execute: jest.fn().mockRejectedValue(new Error('boom')),
            };
            const capB: ICapability = {
                name: 'cap-b',
                execute: jest.fn().mockResolvedValue({
                    capabilityName: 'cap-b',
                    insights: [],
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [capA, capB] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);
            const { results, errors } = await manager.executeAll(mockInput);

            expect(results).toHaveLength(1);
            expect(results[0].capabilityName).toBe('cap-b');
            expect(errors).toHaveLength(1);
            expect(errors[0].capabilityName).toBe('cap-a');
            expect(errors[0].error).toBe('boom');
        });

        it('handles all capabilities failing', async () => {
            const capA: ICapability = {
                name: 'cap-a',
                execute: jest.fn().mockRejectedValue(new Error('err1')),
            };
            const capB: ICapability = {
                name: 'cap-b',
                execute: jest.fn().mockRejectedValue(new Error('err2')),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [capA, capB] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);
            const { results, errors } = await manager.executeAll(mockInput);

            expect(results).toHaveLength(0);
            expect(errors).toHaveLength(2);
        });

        it('handles empty capability list', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);
            const { results, errors } = await manager.executeAll(mockInput);

            expect(results).toHaveLength(0);
            expect(errors).toHaveLength(0);
        });
    });

    describe('executeByName', () => {
        it('runs a single capability by name', async () => {
            const insight = {
                id: 'i1',
                type: 'TASK' as const,
                content: 'x',
                owners: [],
            };
            const cap: ICapability = {
                name: 'my-cap',
                execute: jest.fn().mockResolvedValue({
                    capabilityName: 'my-cap',
                    insights: [insight],
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [cap] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);
            const result = await manager.executeByName('my-cap', mockInput);

            expect(result.insights).toEqual([insight]);
        });

        it('throws NotFoundException for unknown name', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);

            await expect(
                manager.executeByName('nope', mockInput),
            ).rejects.toThrow(NotFoundException);
        });

        it('propagates capability errors', async () => {
            const cap: ICapability = {
                name: 'bad-cap',
                execute: jest.fn().mockRejectedValue(new Error('failed')),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CapabilityManager,
                    { provide: CAPABILITY, useValue: [cap] },
                ],
            }).compile();

            const manager = module.get(CapabilityManager);

            await expect(
                manager.executeByName('bad-cap', mockInput),
            ).rejects.toThrow('failed');
        });
    });
});
