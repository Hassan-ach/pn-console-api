import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DemoMessageDto {
    @ApiProperty({ example: 'Hey team, we need to deploy the hotfix by Friday' })
    @IsString()
    content: string;

    @ApiPropertyOptional({ enum: ['direct', 'email'], default: 'direct' })
    @IsOptional()
    @IsString()
    type?: 'direct' | 'email';

    @ApiPropertyOptional({ example: 'user-123' })
    @IsOptional()
    @IsString()
    authorId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    groupId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    channelId?: string;
}

export class GenerateInsightsDto {
    @ApiProperty({ example: 'org-abc-123' })
    @IsString()
    organizationId: string;

    @ApiProperty({ type: [DemoMessageDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DemoMessageDto)
    messages: DemoMessageDto[];
}
