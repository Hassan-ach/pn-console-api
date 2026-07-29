import { Injectable } from '@nestjs/common';
import { AppDbService } from 'src/prisma/app-db/app-db.service';

@Injectable()
export class ActiveChatListenerRepository {
    constructor(private readonly prisma: AppDbService) {}

    async findByPluginAndChat(pluginName: string, chatId: string) {
        return this.prisma.activeChatListener.findUnique({
            where: { pluginName_chatId: { pluginName, chatId } },
        });
    }

    async findAllActive() {
        return this.prisma.activeChatListener.findMany();
    }

    async subscribe(
        pluginName: string,
        chatId: string,
        organizationId: string,
        userId: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.activeChatListener.findUnique({
                where: { pluginName_chatId: { pluginName, chatId } },
            });
            if (existing) {
                return tx.activeChatListener.update({
                    where: { id: existing.id },
                    data: { subscriberCount: { increment: 1 } },
                });
            }
            return tx.activeChatListener.create({
                data: {
                    pluginName,
                    chatId,
                    organizationId,
                    ownerUserId: userId,
                    subscriberCount: 1,
                },
            });
        });
    }

    async unsubscribe(pluginName: string, chatId: string, _userId: string) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.activeChatListener.findUnique({
                where: { pluginName_chatId: { pluginName, chatId } },
            });
            if (!existing) return null;
            const newCount = existing.subscriberCount - 1;
            if (newCount <= 0) {
                await tx.activeChatListener.delete({
                    where: { id: existing.id },
                });
                return { deleted: true };
            }
            return tx.activeChatListener.update({
                where: { id: existing.id },
                data: { subscriberCount: newCount },
            });
        });
    }

    async transferOwnership(
        pluginName: string,
        chatId: string,
        newOwnerUserId: string,
    ) {
        return this.prisma.activeChatListener.update({
            where: { pluginName_chatId: { pluginName, chatId } },
            data: { ownerUserId: newOwnerUserId },
        });
    }

    async deleteByPluginAndChat(pluginName: string, chatId: string) {
        return this.prisma.activeChatListener.delete({
            where: { pluginName_chatId: { pluginName, chatId } },
        });
    }

    async claim(id: string, instanceId: string) {
        return this.prisma.activeChatListener.update({
            where: { id },
            data: { claimedBy: instanceId, heartbeatAt: new Date() },
        });
    }

    async heartbeat(id: string) {
        return this.prisma.activeChatListener.update({
            where: { id },
            data: { heartbeatAt: new Date() },
        });
    }

    async releaseClaim(id: string) {
        return this.prisma.activeChatListener.update({
            where: { id },
            data: { claimedBy: null, heartbeatAt: null },
        });
    }

    async findStale(
        heartbeatTimeoutMs: number,
    ): Promise<{ id: string; pluginName: string; chatId: string }[]> {
        const threshold = new Date(Date.now() - heartbeatTimeoutMs);
        return this.prisma.activeChatListener.findMany({
            where: {
                claimedBy: { not: null },
                heartbeatAt: { lt: threshold },
            },
            select: { id: true, pluginName: true, chatId: true },
        });
    }

    async delete(id: string) {
        return this.prisma.activeChatListener.delete({ where: { id } });
    }

    async getSubscriberUserIds(
        pluginName: string,
        chatId: string,
        excludeUserId: string,
    ): Promise<string[]> {
        const rows = await this.prisma.activeChatListener.findMany({
            where: { pluginName, chatId },
        });
        return rows
            .filter((r) => r.ownerUserId !== excludeUserId)
            .map((r) => r.ownerUserId);
    }
}
