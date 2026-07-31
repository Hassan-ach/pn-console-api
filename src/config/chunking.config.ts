import { registerAs } from '@nestjs/config';

export enum PartitionerType {
    Source = 'source',
    GroupId = 'group-id',
    ChannelId = 'channel-id',
    TopicId = 'topic-id',
    Daily = 'daily',
}

export default registerAs('chunking', () => ({
    minChunkMessages: 30,
    maxChunkMessages: 60,
    timeGapMinutes: 30,
    maxWindowMinutes: 240,
    partitionStrategy: [
        PartitionerType.Source,
        PartitionerType.GroupId,
        PartitionerType.ChannelId,
        PartitionerType.Daily,
    ],
}));
