import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER, publicKeyFor } from '../common/security';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email, role: payload.role ?? 'user' };
  }
}
