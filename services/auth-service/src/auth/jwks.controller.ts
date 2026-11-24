import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { publicJwks } from './signing-key';

/** Public verification keys of access tokens (standard JWKS document, no secrets). */
@ApiTags('Auth')
@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Public keys (JWK Set) that verify access tokens' })
  jwks() {
    return publicJwks();
  }
}
