import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PluginConfigDto {
    @ApiProperty({
        description:
            'Plugin configuration object (e.g., apiId, apiHash, sessionString, chats)',
        example: {
            apiId: 12345,
            apiHash: 'abc123',
            sessionString: '...',
            chats: [123456789],
        },
    })
    @IsObject()
    config: Record<string, unknown>;
}
