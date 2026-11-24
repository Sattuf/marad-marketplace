import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class DecryptKycDto {
  @ApiProperty({ description: 'KYC session id to decrypt (admin only, audited)' })
  @IsString()
  @Length(1, 128)
  sessionId: string;
}
