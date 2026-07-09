import { Module } from '@nestjs/common';
import { ChunkingPipeline } from './chunking-pipeline.service';
import { CHUNKING_STRATEGY } from './chunking.token';
import { CompositeChunkingStrategy } from './composite-chunking-strategy';
import { TimeGapChunkStrategy } from './strategies/time-gap-chunk.strategy';
import { SourcePartitioner } from './partitioners/source-partitioner';
import { GroupIdPartitioner } from './partitioners/group-id-partitioner';
import { ChannelIdPartitioner } from './partitioners/channel-id-partitioner';

@Module({
    providers: [
        ChunkingPipeline,
        {
            provide: CHUNKING_STRATEGY,
            useFactory: () =>
                new CompositeChunkingStrategy({
                    partitioners: [
                        new SourcePartitioner(),
                        new GroupIdPartitioner(),
                        new ChannelIdPartitioner(),
                    ],
                    chunker: new TimeGapChunkStrategy({
                        gapMinutes: 30,
                        maxWindowMinutes: 240,
                    }),
                    minMessages: 10,
                }),
            multi: true,
        } as any,
    ],
    exports: [ChunkingPipeline],
})
export class ChunkingModule {}
