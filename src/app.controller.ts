import { Controller, Get } from '@nestjs/common';
import { RawDbService } from './prisma/raw-db/raw-db.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
    constructor(private readonly prisma: RawDbService) {}

    @Public()
    @Get('health')
    @ApiOperation({ summary: 'Health check' })
    async health() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok', database: 'connected' };
        } catch {
            return { status: 'error', database: 'disconnected' };
        }
    }
}
