import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10000)
    message!: string;

    @IsOptional()
    @IsString()
    @IsUUID()
    conversationId?: string;
}
