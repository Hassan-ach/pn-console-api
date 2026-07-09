import {
    IsString,
    IsBoolean,
    IsObject,
    IsOptional,
    IsDateString,
    IsEnum,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnvelopeDataDto {
    @ApiProperty()
    @IsString()
    source_plugin: string;

    @ApiProperty()
    @IsString()
    source_id: string;

    @ApiProperty({ enum: ['message'] })
    @IsEnum(['message'] as const)
    type: 'message';

    @ApiProperty()
    @IsBoolean()
    has_attachment: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    author_id: string | null;

    @ApiProperty()
    @IsDateString()
    occurred_at: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    organization_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    permissions?: Record<string, unknown>;
}

export class MessagePayloadDataDto {
    @ApiProperty({ enum: ['direct', 'email'] })
    @IsEnum(['direct', 'email'] as const)
    type: 'direct' | 'email';

    @ApiProperty()
    @IsString()
    content: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    group_id: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    channel_id: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    reply_to: string | null;

    @ApiProperty()
    @IsObject()
    reactions: Record<string, unknown>;

    @ApiProperty()
    @IsBoolean()
    pinned: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    edited_date: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsObject()
    entities: Record<string, unknown> | null;

    @ApiProperty()
    @IsObject()
    raw_payload: Record<string, unknown>;
}

export class CreateEnvelopeDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => EnvelopeDataDto)
    envelope: EnvelopeDataDto;

    @ApiProperty()
    @ValidateNested()
    @Type(() => MessagePayloadDataDto)
    payload: MessagePayloadDataDto;
}
