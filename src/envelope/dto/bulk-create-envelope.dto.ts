import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateEnvelopeDto } from './create-envelope.dto';

export class BulkCreateEnvelopeDto {
  @ApiProperty({ type: [CreateEnvelopeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEnvelopeDto)
  items: CreateEnvelopeDto[];
}
