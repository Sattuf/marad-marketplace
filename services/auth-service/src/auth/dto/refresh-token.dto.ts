import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    example: 'refresh_token_here',
    description: 'رمز التحديث — mobile clients send it; the web app uses the HttpOnly cookie instead',
  })
  @IsOptional()
  @IsString({ message: 'رمز التحديث يجب أن يكون نصًا' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  refresh_token?: string;
}
