import { Injectable } from '@nestjs/common';
import { RawDbService } from '../../prisma/raw-db/raw-db.service';

export interface ResumeStrategy {
    type: 'initial' | 'gap';
    cursor?: number;
}

@Injectable()
export class StreamingResumeService {
    constructor(private readonly rawDb: RawDbService) {}

    async resolve(
        pluginName: string,
        userId: string,
        chatId: string,
        _limit: number,
    ): Promise<ResumeStrategy> {
        const cursor = await this.rawDb.pluginCursor.findUnique({
            where: {
                pluginName_userId_key: { pluginName, userId, key: chatId },
            },
        });

        if (cursor) {
            return { type: 'gap', cursor: Number(cursor.value) };
        }

        return { type: 'initial' };
    }
}
