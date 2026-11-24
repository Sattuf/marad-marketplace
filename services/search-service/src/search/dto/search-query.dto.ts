import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Query params are strings on the wire. The pipe rejects wrong types and absurd sizes;
 * the service still clamps page/limit and trims the text, so in-range values never fail.
 */
export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Search text (max 100 chars are used)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @ApiPropertyOptional({ description: 'Category id; a parent includes its subcategories' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  minPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  maxPrice?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ description: 'Anonymous visitor id for sticky A/B assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_id?: string;
}
