import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class TrackClickDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  query: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  listing_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  position?: number;

  @ApiProperty({ enum: ['A', 'B'] })
  @IsIn(['A', 'B'])
  variant: 'A' | 'B';

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  session_id: string;
}
