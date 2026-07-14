import { Injectable, Logger } from '@nestjs/common';
import { RawDbService } from '../../prisma/raw-db/raw-db.service';
import { RetrievalWindow } from './retrieval-window.type';

@Injectable()
export class WindowDiscoveryService {
    private readonly logger = new Logger(WindowDiscoveryService.name);

    constructor(private readonly rawDb: RawDbService) {}

    async discoverWindows(
        organizationId: string,
        options?: {
            minMessages?: number;
            windowStart?: Date;
            windowEnd?: Date;
        },
    ): Promise<RetrievalWindow[]> {
        const minMessages = options?.minMessages ?? 1000;

        type RawWindow = {
            window_start: Date;
            window_end: Date;
            message_count: bigint;
        };

        const rows = await this.rawDb.$queryRawUnsafe<RawWindow[]>(
            `
            WITH RECURSIVE daily AS (
                SELECT
                    DATE(occurred_at) AS day,
                    COUNT(*)::int AS cnt,
                    ROW_NUMBER() OVER (ORDER BY DATE(occurred_at)) AS rn
                FROM envelope
                WHERE organization_id = $1
                  AND ($2::date IS NULL OR occurred_at >= $2::timestamptz)
                  AND ($3::date IS NULL OR occurred_at <= ($3::timestamptz + INTERVAL '1 day - 1 second'))
                GROUP BY day
            ),
            windows AS (
                SELECT
                    rn,
                    day AS window_start,
                    day AS window_end,
                    cnt AS running_total,
                    1 AS window_id
                FROM daily
                WHERE rn = 1

                UNION ALL

                SELECT
                    d.rn,
                    CASE WHEN w.running_total < $4
                         THEN w.window_start
                         ELSE d.day
                    END,
                    d.day,
                    CASE WHEN w.running_total < $4
                         THEN w.running_total + d.cnt
                         ELSE d.cnt
                    END,
                    CASE WHEN w.running_total < $4
                         THEN w.window_id
                         ELSE w.window_id + 1
                    END
                FROM windows w
                JOIN daily d ON d.rn = w.rn + 1
            )
            SELECT
                MIN(window_start) AS window_start,
                MAX(window_end)   AS window_end,
                MAX(running_total)::bigint AS message_count
            FROM windows
            GROUP BY window_id
            ORDER BY window_id
            `,
            organizationId,
            options?.windowStart ?? null,
            options?.windowEnd ?? null,
            minMessages,
        );

        const windows = rows.map((r) => {
            const start = new Date(r.window_start);
            start.setUTCHours(0, 0, 0, 0);

            const end = new Date(r.window_end);
            end.setUTCHours(23, 59, 59, 999);

            return {
                start,
                end,
                messageCount: Number(r.message_count),
            };
        });

        this.logger.log(
            `Discovered ${windows.length} windows for org=${organizationId} (minMessages=${minMessages})`,
        );

        return windows;
    }
}
