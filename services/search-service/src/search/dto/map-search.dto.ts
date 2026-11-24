import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class MapSearchDto {
  @ApiProperty({ description: 'Top left latitude', type: Number })
  @Type(() => Number)
  @IsLatitude()
  topLeftLat: number;

  @ApiProperty({ description: 'Top left longitude', type: Number })
  @Type(() => Number)
  @IsLongitude()
  topLeftLon: number;

  @ApiProperty({ description: 'Bottom right latitude', type: Number })
  @Type(() => Number)
  @IsLatitude()
  bottomRightLat: number;

  @ApiProperty({ description: 'Bottom right longitude', type: Number })
  @Type(() => Number)
  @IsLongitude()
  bottomRightLon: number;

  @ApiPropertyOptional({ description: 'Map zoom level', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(22)
  zoom?: number;
}
