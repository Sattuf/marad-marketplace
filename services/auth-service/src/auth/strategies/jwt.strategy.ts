import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { isBlockedStatus } from '../../users/entities/user.entity';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER, publicKeyFor } from '../../common/security';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // RS256 only, key chosen by the token's kid from JWT_PUBLIC_JWKS (see common/security).
      secretOrKeyProvider: (_req: any, rawJwt: any, done: any) => {
        try {
          const key = publicKeyFor(rawJwt);
          return key ? done(null, key) : done(new UnauthorizedException('Unknown signing key'));
        } catch (error) {
          return done(error);
        }
      },
      algorithms: ['RS256'],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }
    if (isBlockedStatus(user.status)) {
      throw new UnauthorizedException('حسابك موقوف حالياً');
    }
    // Same shape as the login response's `user`, so GET /auth/me can restore a session.
    return {
      id: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      fullName: user.fullName,
      avatar: user.avatarUrl ?? undefined,
      role: user.role,
      status: user.status,
    };
  }
}
