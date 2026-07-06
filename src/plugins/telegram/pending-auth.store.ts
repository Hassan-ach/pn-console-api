import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonStore } from '../common/json-store';
import type { PendingAuth } from './telegram.types';

@Injectable()
export class PendingAuthStore extends JsonStore<PendingAuth> {
    constructor() {
        const filePath = path.join(
            os.homedir(),
            '.pn-console',
            'plugins',
            'telegram',
            'pending-auth.json',
        );
        super(filePath);
    }
}
