import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonStore } from '../common/json-store';
import type { TelegramSession } from './telegram.types';

@Injectable()
export class TelegramSessionStore extends JsonStore<TelegramSession> {
    constructor() {
        const filePath = path.join(
            os.homedir(),
            '.pn-console',
            'plugins',
            'telegram',
            'sessions.json',
        );
        super(filePath);
    }
}
