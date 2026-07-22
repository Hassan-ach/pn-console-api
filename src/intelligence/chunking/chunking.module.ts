import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChunkingPipeline } from './chunking-pipeline.service';
import { CHUNKING_STRATEGY } from './chunking.token';
import { CompositeChunkingStrategy } from './composite-chunking-strategy';
import { SourcePartitioner } from './partitioners/source-partitioner';
import { GroupIdPartitioner } from './partitioners/group-id-partitioner';
import { ChannelIdPartitioner } from './partitioners/channel-id-partitioner';
import { TopicIdPartitioner } from './partitioners/topic-id-partitioner';
import { DailyPartitioner } from './partitioners/daily-partitioner';
import { PartitionerType } from '../../config/chunking.config';
import { Partitioner } from './partitioners/partitioner.interface';

@Module({
    providers: [
        ChunkingPipeline,
        {
            provide: CHUNKING_STRATEGY,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const enabled = config.get<PartitionerType[]>(
                    'chunking.partitionStrategy',
                );
                const registry: Record<PartitionerType, () => Partitioner> = {
                    [PartitionerType.Source]: () => new SourcePartitioner(),
                    [PartitionerType.GroupId]: () => new GroupIdPartitioner(),
                    [PartitionerType.ChannelId]: () =>
                        new ChannelIdPartitioner(),
                    [PartitionerType.TopicId]: () => new TopicIdPartitioner(),
                    [PartitionerType.Daily]: () =>
                        new DailyPartitioner({
                            minChunkMessages: config.get<number>(
                                'chunking.minChunkMessages',
                                30,
                            ),
                            maxChunkMessages: config.get<number>(
                                'chunking.maxChunkMessages',
                                60,
                            ),
                        }),
                };
                return [
                    new CompositeChunkingStrategy({
                        partitioners: enabled
                            ? enabled.map((t) => registry[t]())
                            : [],
                    }),
                ];
            },
        },
    ],
    exports: [ChunkingPipeline],
})
export class ChunkingModule {}
