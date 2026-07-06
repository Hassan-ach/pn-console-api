import { Injectable, Logger } from '@nestjs/common';
import { Api, TelegramClient as GramJsClient } from 'telegram';
import { computeCheck } from 'telegram/Password';
import { TelegramClientFactory } from './telegram-client.factory';
import { TelegramSessionStore } from './telegram-session.store';
import { PendingAuthStore } from './pending-auth.store';
import type { TelegramSession } from './telegram.types';

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);
  private pendingClients = new Map<
    string,
    { client: GramJsClient; cleanup: NodeJS.Timeout }
  >();

  constructor(
    private readonly factory: TelegramClientFactory,
    private readonly sessionStore: TelegramSessionStore,
    private readonly pendingAuthStore: PendingAuthStore,
  ) {}

  async authenticate(
    phone: string,
    userId: string,
    apiId: number,
    apiHash: string,
  ): Promise<
    | { status: 'ok' }
    | { status: 'need_code'; pendingId: string }
  > {
    const existing = await this.sessionStore.get(userId);
    if (existing) {
      const client = this.factory.create(
        apiId,
        apiHash,
        existing.sessionString,
      );
      try {
        await client.connect();
        await client.getMe();
        this.logger.log(`Session valid for user ${userId}`);
        return { status: 'ok' };
      } catch {
        this.logger.warn(
          `Session expired for user ${userId}, reconnecting...`,
        );
        await this.sessionStore.delete(userId);
      } finally {
        await this.factory.destroy(client);
      }
    }

    return this.sendCode(phone, apiId, apiHash);
  }

  private async sendCode(
    phone: string,
    apiId: number,
    apiHash: string,
  ): Promise<{ status: 'need_code'; pendingId: string }> {
    const client = this.factory.create(apiId, apiHash);
    await client.connect();
    const result = await client.sendCode({ apiId, apiHash }, phone);

    const pending: import('./telegram.types').PendingAuth = {
      id: `pending_${Date.now()}`,
      phone,
      phoneCodeHash: result.phoneCodeHash,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    };

    const cleanup = setTimeout(() => {
      this.cleanupClient(pending.id);
    }, 120_000);

    this.pendingClients.set(pending.id, { client, cleanup });
    await this.pendingAuthStore.set(pending.id, pending);
    this.logger.log(
      `Auth code sent to ${phone}, pendingId: ${pending.id}`,
    );

    return { status: 'need_code', pendingId: pending.id };
  }

  async verifyCode(
    pendingId: string,
    code: string,
    userId: string,
    apiId: number,
    apiHash: string,
  ): Promise<
    | { status: 'ok' }
    | { status: 'need_password'; pendingId: string }
  > {
    const pending = await this.pendingAuthStore.get(pendingId);
    if (!pending) throw new Error('Invalid or expired pendingId');

    const entry = this.pendingClients.get(pendingId);
    if (!entry) throw new Error('Pending auth expired or invalid');
    const client = entry.client;

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: pending.phone,
          phoneCode: code,
          phoneCodeHash: pending.phoneCodeHash,
        }),
      );

      const sessionString = (client.session as any).save() as string;

      await this.sessionStore.set(userId, {
        id: userId,
        phone: pending.phone,
        sessionString,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.cleanupClient(pendingId);
      await this.pendingAuthStore.delete(pendingId);
      this.logger.log(`Session saved for user ${userId}`);

      return { status: 'ok' };
    } catch (err: any) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        const passwordPendingId = `password_${Date.now()}`;

        // Move client to new pendingId for password step
        clearTimeout(entry.cleanup);
        this.pendingClients.delete(pendingId);

        const cleanup = setTimeout(() => {
          this.cleanupClient(passwordPendingId);
        }, 120_000);

        this.pendingClients.set(passwordPendingId, { client, cleanup });

        await this.pendingAuthStore.set(passwordPendingId, {
          id: passwordPendingId,
          phone: pending.phone,
          phoneCodeHash: pending.phoneCodeHash,
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        });

        await this.pendingAuthStore.delete(pendingId);
        this.logger.log(`2FA required for ${pending.phone}`);

        return {
          status: 'need_password',
          pendingId: passwordPendingId,
        };
      }

      this.cleanupClient(pendingId);
      this.logger.log(
        `Error verifying code for ${pending.phone}: ${err.message}`,
      );
      throw err;
    }
  }

  async verifyPassword(
    pendingId: string,
    password: string,
    userId: string,
    apiId: number,
    apiHash: string,
  ): Promise<{ status: 'ok' }> {
    const pending = await this.pendingAuthStore.get(pendingId);
    if (!pending) throw new Error('Invalid or expired pendingId');

    const entry = this.pendingClients.get(pendingId);
    if (!entry) throw new Error('Password auth expired or invalid');
    const client = entry.client;

    try {
      const passwordInfo = await client.invoke(
        new Api.account.GetPassword(),
      );
      const inputCheck = await computeCheck(passwordInfo, password);
      await client.invoke(
        new Api.auth.CheckPassword({ password: inputCheck }),
      );

      const sessionString = (client.session as any).save() as string;

      await this.sessionStore.set(userId, {
        id: userId,
        phone: pending.phone,
        sessionString,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.cleanupClient(pendingId);
      await this.pendingAuthStore.delete(pendingId);
      this.logger.log(`Session saved for user ${userId} (with 2FA)`);

      return { status: 'ok' };
    } catch (err) {
      this.cleanupClient(pendingId);
      throw err;
    }
  }

  async loadSession(
    userId: string,
    apiId: number,
    apiHash: string,
  ): Promise<{ client: GramJsClient; session: TelegramSession }> {
    const session = await this.sessionStore.get(userId);
    if (!session) throw new Error('No session found. Login first.');

    const client = this.factory.create(
      apiId,
      apiHash,
      session.sessionString,
    );
    await client.connect();
    return { client, session };
  }

  async logout(userId: string): Promise<void> {
    await this.sessionStore.delete(userId);
    this.logger.log(`Session deleted for user ${userId}`);
  }

  private cleanupClient(pendingId: string): void {
    const entry = this.pendingClients.get(pendingId);
    if (!entry) return;
    clearTimeout(entry.cleanup);
    this.pendingClients.delete(pendingId);
    this.factory.destroy(entry.client).catch(() => {});
  }
}
