import { registerAs } from '@nestjs/config';
import * as path from 'node:path';
import * as os from 'node:os';

export default registerAs('telegram', () => ({
    connectionRetries: 5,
    useWSS: true,
    backfillMode: 'last', // 'first' | 'last'
    backfillBatchSize: 100,
    backfillOffsetId: 1,
    defaultTopicId: 1,
    flushIntervalMs: 5000,
    topicStoreBasePath: path.join(
        os.homedir(),
        '.pn-console',
        'plugins',
        'telegram',
    ),
    topicStoreFileSuffix: '__topics.json',
}));
