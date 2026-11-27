import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  // POST rather than DELETE: some proxies and HTTP clients drop DELETE bodies.
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف الحساب — Close the account (restorable for 30 days by signing in)' })
  @ApiResponse({ status: 200, description: 'Account closed; every session revoked' })
  @ApiResponse({ status: 401, description: 'Re-authentication missing or wrong' })
  @ApiResponse({ status: 502, description: 'A dependent service is unavailable; nothing changed' })
  deleteAccount(@Req() req: { user: { id: string } }, @Body() dto: DeleteAccountDto) {
    return this.deletion.requestDeletion(req.user.id, dto);
  }
}
