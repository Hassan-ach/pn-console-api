import { Module } from '@nestjs/common';
import { ChunkingPipeline } from './chunking-pipeline.service';
import { CHUNKING_STRATEGY } from './chunking.token';
import { CompositeChunkingStrategy } from './composite-chunking-strategy';
import { SourcePartitioner } from './partitioners/source-partitioner';
import { GroupIdPartitioner } from './partitioners/group-id-partitioner';
import { ChannelIdPartitioner } from './partitioners/channel-id-partitioner';
import { TopicIdPartitioner } from './partitioners/topic-id-partitioner';
import { DailyPartitioner } from './partitioners/daily-partitioner';

@Module({
    providers: [
        ChunkingPipeline,
        {
            provide: CHUNKING_STRATEGY,
            useFactory: () => [
                new CompositeChunkingStrategy({
                    partitioners: [
                        new SourcePartitioner(),
                        new GroupIdPartitioner(),
                        new ChannelIdPartitioner(),
                        new TopicIdPartitioner(),
                        new DailyPartitioner({
                            minChunkMessages: 30,
                            maxChunkMessages: 60,
                        }),
                    ],
                }),
            ],
        },
    ],
    exports: [ChunkingPipeline],
})
export class ChunkingModule {}
