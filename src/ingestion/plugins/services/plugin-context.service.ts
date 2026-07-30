import { Injectable, Logger } from '@nestjs/common';
import { PluginConfigRepository } from 'src/repositories/plugin-config.repository';
import { EnvelopeRepository } from 'src/repositories/envelope.repository';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { RawDbService } from 'src/prisma/raw-db/raw-db.service';
import type { EnvelopeWithPayload } from 'src/types/envelope.types';
import type {
    PluginContext,
    PluginLogger,
    StoreResult,
} from '../interfaces/plugin-context.interface';

@Injectable()
export class PluginContextService implements PluginContext {
    readonly logger: PluginLogger = {
        info: (msg) => this.nestLogger.log(msg),
        warn: (msg) => this.nestLogger.warn(msg),
        error: (msg) => this.nestLogger.error(msg),
        debug: (msg) => this.nestLogger.debug(msg),
    };

    private readonly nestLogger = new Logger('PluginContext');

    constructor(
        private readonly configRepo: PluginConfigRepository,
        private readonly envelopeRepo: EnvelopeRepository,
        private readonly mappingRepo: PlatformUserMappingRepository,
        private readonly userRepo: UserRepository,
        private readonly rawDb: RawDbService,
    ) {}

    async getConfig(
        userId: string,
        pluginName: string,
    ): Promise<Record<string, unknown> | null> {
        const row = await this.configRepo.findUnique(userId, pluginName);
        if (!row) return null;
        return { ...row.config, sessionString: row.sessionString ?? undefined };
    }

    async saveConfig(
        userId: string,
        pluginName: string,
        config: Record<string, unknown>,
    ): Promise<void> {
        const orgId = await this.resolveOrgIdAsync(userId);
        await this.configRepo.upsert(userId, pluginName, {
            organizationId: orgId,
            config: config,
            metadata: undefined,
        });
    }

    async updateConfig(
        userId: string,
        pluginName: string,
        partial: Record<string, unknown>,
    ): Promise<void> {
        await this.configRepo.update(userId, pluginName, { config: partial });
    }

    async storeUserMapping(
        userId: string,
        pluginName: string,
        data: {
            platformUserId: string;
            platformUsername: string;
        },
    ): Promise<void> {
        await this.mappingRepo.upsert({
            appUserId: userId,
            pluginName,
            platformUserId: data.platformUserId,
            platformUsername: data.platformUsername,
        });
    }

    async getCursor(
        pluginName: string,
        userId: string,
        key: string,
    ): Promise<number | null> {
        const row = await this.rawDb.pluginCursor.findUnique({
            where: { pluginName_userId_key: { pluginName, userId, key } },
        });
        return row ? Number(row.value) : null;
    }

    async saveCursor(
        pluginName: string,
        userId: string,
        key: string,
        value: number,
    ): Promise<void> {
        await this.rawDb.pluginCursor.upsert({
            where: { pluginName_userId_key: { pluginName, userId, key } },
            create: { pluginName, userId, key, value },
            update: { value },
        });
    }

    async storeEnvelopes(
        items: EnvelopeWithPayload[],
        userId: string,
    ): Promise<StoreResult> {
        const orgId = await this.resolveOrgIdAsync(userId);
        const inputs = items.map((item) => ({
            envelope: {
                sourcePlugin: item.envelope.sourcePlugin,
                sourceId: item.envelope.sourceId,
                type: item.envelope.type,
                hasAttachment: item.envelope.hasAttachment,
                authorId: item.envelope.authorId,
                organizationId: item.envelope.organizationId ?? orgId,
                status: item.envelope.status ?? 'PENDING',
                permissions: item.envelope.permissions,
                occurredAt: item.envelope.occurredAt,
            },
            payload: item.payload,
        }));
        this.nestLogger.debug(
            `storeEnvelopes: ${items.length} items for user ${userId}`,
        );
        const result = await this.envelopeRepo.createManyWithPayload(inputs);
        this.nestLogger.debug(
            `storeEnvelopes result: ${result.inserted} inserted`,
        );
        return result;
    }

    async resolveOrgIdAsync(userId: string): Promise<string> {
        const user = await this.userRepo.findById(userId);
        return user?.organizationId ?? 'org-1';
    }

    resolveOrgId(_userId: string): string {
        return 'org-1';
    }
}
