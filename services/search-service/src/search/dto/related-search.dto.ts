import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RelatedSearchDto {
  @ApiProperty({ description: 'Original listing ID' })
  @IsUUID()
  id: string;
}
