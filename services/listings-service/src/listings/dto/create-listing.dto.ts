import { IsString, IsNumber, IsOptional, IsUUID, IsPositive, IsIn } from 'class-validator';
import { CURRENCY_NAMES_AR } from '../../common/markets.generated';

/** ISO 4217 codes of every market in packages/markets/markets.json. */
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_NAMES_AR);
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, description: 'Defaults to DEFAULT_LISTING_CURRENCY' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES, { message: 'عملة غير مدعومة' })
  currency?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
