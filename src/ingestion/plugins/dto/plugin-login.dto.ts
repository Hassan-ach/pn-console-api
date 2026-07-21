import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PluginLoginDto {
    @ApiProperty({
        description:
            'Full plugin configuration including session string, API credentials, etc.',
        example: {
            apiId: 12345,
            apiHash: 'abc123',
            sessionString: '1.AQEA...',
            chats: [123456789],
        },
    })
    @IsObject()
    config: Record<string, unknown>;
}
