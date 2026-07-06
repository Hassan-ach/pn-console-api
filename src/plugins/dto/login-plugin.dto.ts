import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginPluginDto {
  @ApiProperty()
  @IsObject()
  credentials: Record<string, unknown>;
}
