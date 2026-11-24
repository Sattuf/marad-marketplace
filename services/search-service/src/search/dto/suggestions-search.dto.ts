import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SuggestionsSearchDto {
  @ApiProperty({ description: 'Search query string' })
  @IsString()
  @MaxLength(200)
  q: string;
}
