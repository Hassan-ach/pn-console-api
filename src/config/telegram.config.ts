import { registerAs } from '@nestjs/config';
import * as path from 'node:path';
import * as os from 'node:os';

export default registerAs('telegram', () => ({
    connectionRetries: 5,
    useWSS: true,
    backfillMode: 'first', // 'first' | 'last'
    backfillBatchSize: 100,
    backfillOffsetId: 1,
    reverse: true,
    defaultTopicId: 1,
    topicStoreBasePath: path.join(
        os.homedir(),
        '.pn-console',
        'plugins',
        'telegram',
    ),
    topicStoreFileSuffix: '__topics.json',
}));
