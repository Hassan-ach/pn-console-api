import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializePluginDto {
    @ApiProperty()
    @IsObject()
    config: Record<string, unknown>;
}
