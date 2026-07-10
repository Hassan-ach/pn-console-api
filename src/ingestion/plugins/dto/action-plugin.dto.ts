import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PluginActionDto {
    @ApiProperty()
    @IsString()
    action: string;

    @ApiProperty()
    @IsObject()
    params: Record<string, unknown>;
}
