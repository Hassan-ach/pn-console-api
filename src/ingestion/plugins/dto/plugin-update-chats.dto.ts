import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class ChatItemDto {
    @ApiProperty({ description: 'Chat ID or username', example: 'chat_123' })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Human readable chat title',
        example: 'Engineering Announcements',
    })
    @IsString()
    name: string;

    @ApiPropertyOptional({
        description: 'Optional maximum messages to backfill for this chat',
        example: 100,
    })
    @IsOptional()
    @IsNumber()
    historyLimit?: number;
}

export class PluginUpdateChatsDto {
    @ApiProperty({
        description: 'List of chats to monitor',
        type: [ChatItemDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatItemDto)
    chats: ChatItemDto[];
}
