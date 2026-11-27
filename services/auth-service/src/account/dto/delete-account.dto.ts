import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Exactly one proof is needed; the service checks them in this order. */
export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Current password' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: '6-digit code from POST /send-otp to the account phone' })
  @IsOptional()
  @Matches(/^\d{6}$/)
  otp?: string;

  @ApiPropertyOptional({ description: 'Fresh Google ID token (Google-only accounts)' })
  @IsOptional()
  @IsString()
  @Length(20, 4096)
  googleIdToken?: string;
}
