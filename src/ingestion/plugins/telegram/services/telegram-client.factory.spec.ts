import { ConfigService } from '@nestjs/config';
import { TelegramClientFactory } from './telegram-client.factory';

describe('TelegramClientFactory', () => {
    let factory: TelegramClientFactory;

    beforeEach(() => {
        const config = {
            get: jest.fn().mockReturnValue(5),
        } as unknown as ConfigService;
        factory = new TelegramClientFactory(config);
    });

    describe('create', () => {
        it('creates a client with given apiId and apiHash', () => {
            const client = factory.create(12345, 'hash123');
            expect(client).toBeDefined();
            expect(client.apiId).toBe(12345);
            expect(client.apiHash).toBe('hash123');
        });

        it('creates a client with empty session string', () => {
            const client = factory.create(12345, 'hash123', '');
            expect(client).toBeDefined();
        });
    });

    describe('destroy', () => {
        it('calls client.destroy without error', async () => {
            const client = factory.create(1, 'h');
            // destroy should not throw even on unconnected client
            await expect(factory.destroy(client)).resolves.toBeUndefined();
        });
    });
});
