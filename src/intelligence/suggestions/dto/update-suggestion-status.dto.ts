import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SuggestionStatus } from 'generated/app-db-client';

export class UpdateSuggestionStatusDto {
    @ApiProperty({
        enum: SuggestionStatus,
        description: 'New status for the suggestion',
        example: SuggestionStatus.ACCEPTED,
    })
    @IsEnum(SuggestionStatus)
    status: SuggestionStatus;
}
