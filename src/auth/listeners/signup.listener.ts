import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { distance } from 'fastest-levenshtein';
import { AppDbService } from 'src/prisma/app-db/app-db.service';
import { UnresolvedOwnerRepository } from 'src/repositories/unresolved-owner.repository';
import { UserSignedUpEvent } from '../events/user-signed-up.event';

@Injectable()
export class SignupListener {
    private readonly logger = new Logger(SignupListener.name);

    constructor(
        private readonly prisma: AppDbService,
        private readonly unresolvedOwnerRepo: UnresolvedOwnerRepository,
    ) {}

    @OnEvent('user.signed.up')
    async handle(event: UserSignedUpEvent) {
        this.logger.log(
            `Processing signup event for user ${event.userId} (${event.email})`,
        );

        await Promise.all([
            this.assignBroadcastedInsights(event.userId),
            this.resolveUnresolvedOwners(event),
        ]);

        this.logger.log(`Signup processing complete for user ${event.userId}`);
    }

    private async assignBroadcastedInsights(userId: string): Promise<void> {
        const latestBroadcasts = await this.prisma.insightVersion.groupBy({
            by: ['insightId'],
            where: { broadcasted: true },
            _max: { version: true },
        });

        if (latestBroadcasts.length === 0) return;

        const versionRecords = await this.prisma.insightVersion.findMany({
            where: {
                insightId: { in: latestBroadcasts.map((v) => v.insightId) },
                broadcasted: true,
            },
            select: { id: true, insightId: true, version: true },
        });

        const latestVersionIds = new Set<string>();
        for (const g of latestBroadcasts) {
            const maxV = g._max.version;
            const match = versionRecords.find(
                (v) => v.insightId === g.insightId && v.version === maxV,
            );
            if (match) latestVersionIds.add(match.id);
        }

        if (latestVersionIds.size === 0) return;

        const existing = await this.prisma.insightVersionOwner.findMany({
            where: {
                userId,
                insightVersionId: { in: [...latestVersionIds] },
            },
            select: { insightVersionId: true },
        });

        const existingIds = new Set(existing.map((e) => e.insightVersionId));
        const toCreate = [...latestVersionIds].filter(
            (id) => !existingIds.has(id),
        );

        if (toCreate.length === 0) return;

        await this.prisma.insightVersionOwner.createMany({
            data: toCreate.map((versionId) => ({
                userId,
                insightVersionId: versionId,
                status: 'PENDING' as const,
            })),
        });

        this.logger.log(
            `Assigned ${toCreate.length} broadcasted insights to user ${userId}`,
        );
    }

    private async resolveUnresolvedOwners(
        event: UserSignedUpEvent,
    ): Promise<void> {
        const names = [
            event.firstName.toLowerCase(),
            (event.lastName ?? '').toLowerCase(),
        ].filter(Boolean);

        if (names.length === 0) return;

        const allUnresolved =
            await this.unresolvedOwnerRepo.findAllWithUsername();

        const maxDistance = parseInt(
            process.env.OWNER_RESOLVER_MAX_DISTANCE ?? '1',
            10,
        );

        const matches: { id: string; insightVersionId: string }[] = [];

        for (const u of allUnresolved) {
            if (!u.platformUsername) continue;

            const query = u.platformUsername.toLowerCase();
            const firstName = event.firstName.toLowerCase();
            const lastName = (event.lastName ?? '').toLowerCase();
            const fullNameFL = `${firstName}${lastName}`;
            const fullNameLF = `${lastName}${firstName}`;

            const d = Math.min(
                distance(query, firstName),
                distance(query, lastName),
                distance(query, fullNameFL),
                distance(query, fullNameLF),
            );

            if (d <= maxDistance) {
                matches.push({
                    id: u.id,
                    insightVersionId: u.insightVersionId,
                });
            }
        }

        if (matches.length === 0) return;

        const existing = await this.prisma.insightVersionOwner.findMany({
            where: {
                userId: event.userId,
                insightVersionId: {
                    in: matches.map((m) => m.insightVersionId),
                },
            },
            select: { insightVersionId: true },
        });

        const existingIds = new Set(existing.map((e) => e.insightVersionId));
        const toCreate = matches.filter(
            (m) => !existingIds.has(m.insightVersionId),
        );

        if (toCreate.length > 0) {
            await this.prisma.insightVersionOwner.createMany({
                data: toCreate.map((m) => ({
                    userId: event.userId,
                    insightVersionId: m.insightVersionId,
                    status: 'PENDING' as const,
                })),
            });
        }

        await this.unresolvedOwnerRepo.deleteMany(matches.map((m) => m.id));

        this.logger.log(
            `Resolved ${matches.length} unresolved owners for user ${event.userId}`,
        );
    }
}
