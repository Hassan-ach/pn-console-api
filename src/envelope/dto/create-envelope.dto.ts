import {
    IsString,
    IsBoolean,
    IsObject,
    IsOptional,
    IsDate,
    IsEnum,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnvelopeDataDto {
    @ApiProperty()
    @IsString()
    sourcePlugin: string;

    @ApiProperty()
    @IsString()
    sourceId: string;

    @ApiProperty({ enum: ['message'] })
    @IsEnum(['message'] as const)
    type: 'message';

    @ApiProperty()
    @IsBoolean()
    hasAttachment: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    authorId: string | null;

    @ApiProperty()
    @IsDate()
    occurredAt: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    organizationId?: string;

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
    groupId: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    channelId: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    replyTo: string | null;

    @ApiProperty()
    @IsObject()
    reactions: Record<string, unknown>;

    @ApiProperty()
    @IsBoolean()
    pinned: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDate()
    editedDate: Date | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsObject()
    entities: Record<string, unknown> | null;

    @ApiProperty()
    @IsObject()
    rawPayload: Record<string, unknown>;
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
