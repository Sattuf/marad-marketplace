import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AdminGuard,
  InternalGuard,
  JwtAuthGuard,
  requireSecret,
  safeEqual,
  verifyAccessToken,
} from './security';

import { generateKeyPairSync } from 'crypto';

const jwt = new JwtService();
const privatePem = () => Buffer.from(process.env.JWT_PRIVATE_KEY_B64!, 'base64').toString('utf8');
/** Signs like auth-service: RS256, its kid, issuer and audience. */
const sign = (payload: object, overrides: Record<string, unknown> = {}) => {
  const options: Record<string, unknown> = {
    privateKey: privatePem(),
    algorithm: 'RS256',
    keyid: process.env.TEST_JWT_KID,
    issuer: 'marad-auth',
    audience: 'marad-api',
    expiresIn: '15m',
    ...overrides,
  };
  for (const k of Object.keys(options)) if (options[k] === undefined) delete options[k];
  return jwt.sign(payload, options as any);
};

const contextFor = (headers: Record<string, string>) => {
  const request: any = { headers };
  return {
    request,
    context: { switchToHttp: () => ({ getRequest: () => request }) } as any,
  };
};

describe('security helpers', () => {
  describe('requireSecret', () => {
    const original = { ...process.env };
    afterEach(() => {
      process.env = { ...original };
    });

    it('throws when the variable is missing', () => {
      delete process.env.SOME_SECRET;
      expect(() => requireSecret('SOME_SECRET')).toThrow('Missing required environment variable SOME_SECRET');
    });

    it('rejects short secrets in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SOME_SECRET = 'short';
      expect(() => requireSecret('SOME_SECRET')).toThrow('at least 32 characters');
    });
  });

  describe('safeEqual', () => {
    it('compares values without accepting non-strings', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abd', 'abc')).toBe(false);
      expect(safeEqual(undefined, 'abc')).toBe(false);
      expect(safeEqual(['abc'], 'abc')).toBe(false);
    });
  });

  describe('verifyAccessToken', () => {
    it('accepts a token signed with the shared secret', () => {
      const user = verifyAccessToken(sign({ sub: 'u-1', role: 'user' }));
      expect(user).toEqual({ userId: 'u-1', email: undefined, role: 'user' });
    });

    it('rejects a token signed with a leaked old HMAC secret (forged)', () => {
      const forged = jwt.sign({ sub: 'u-1', role: 'admin' }, { secret: 'your-secret-key', keyid: process.env.TEST_JWT_KID } as any);
      expect(() => verifyAccessToken(forged)).toThrow(UnauthorizedException);
    });

    it('rejects HS256 signed with the public key as the HMAC secret (algorithm confusion)', () => {
      const jwks = JSON.parse(process.env.JWT_PUBLIC_JWKS!);
      const { createPublicKey } = require('crypto');
      const publicPem = createPublicKey({ key: jwks.keys[0], format: 'jwk' }).export({ type: 'spki', format: 'pem' });
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: process.env.TEST_JWT_KID })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ sub: 'u-1', role: 'admin', iss: 'marad-auth', aud: 'marad-api' })).toString('base64url');
      const mac = require('crypto').createHmac('sha256', publicPem).update(`${header}.${body}`).digest('base64url');
      expect(() => verifyAccessToken(`${header}.${body}.${mac}`)).toThrow(UnauthorizedException);
    });

    it('rejects a token signed by another RSA key, even reusing a valid kid', () => {
      const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
      expect(() => verifyAccessToken(sign({ sub: 'u-1', role: 'admin' }, { privateKey: other }))).toThrow(UnauthorizedException);
    });

    it('rejects an unknown kid, a wrong audience and a wrong issuer', () => {
      expect(() => verifyAccessToken(sign({ sub: 'u-1' }, { keyid: 'someone-else' }))).toThrow(UnauthorizedException);
      expect(() => verifyAccessToken(sign({ sub: 'u-1' }, { audience: 'marad-refresh' }))).toThrow(UnauthorizedException);
      expect(() => verifyAccessToken(sign({ sub: 'u-1' }, { issuer: 'evil' }))).toThrow(UnauthorizedException);
    });

    it('rejects an unsigned token', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ sub: 'victim' })).toString('base64url');
      expect(() => verifyAccessToken(`${header}.${body}.`)).toThrow(UnauthorizedException);
    });

    it('rejects an expired token', () => {
      const expired = sign({ sub: 'u-1', exp: Math.floor(Date.now() / 1000) - 60 }, { expiresIn: undefined });
      expect(() => verifyAccessToken(expired)).toThrow(UnauthorizedException);
    });
  });

  describe('guards', () => {
    it('JwtAuthGuard sets req.user for a valid token', () => {
      const { context, request } = contextFor({ authorization: `Bearer ${sign({ sub: 'u-1' })}` });
      expect(new JwtAuthGuard().canActivate(context)).toBe(true);
      expect(request.user.userId).toBe('u-1');
    });

    it('JwtAuthGuard rejects requests without a token', () => {
      const { context } = contextFor({});
      expect(() => new JwtAuthGuard().canActivate(context)).toThrow(UnauthorizedException);
    });

    it('AdminGuard rejects non-admin users', () => {
      const { context } = contextFor({ authorization: `Bearer ${sign({ sub: 'u-1', role: 'user' })}` });
      expect(() => new AdminGuard().canActivate(context)).toThrow(ForbiddenException);
    });

    it('AdminGuard accepts admins', () => {
      const { context } = contextFor({ authorization: `Bearer ${sign({ sub: 'a-1', role: 'admin' })}` });
      expect(new AdminGuard().canActivate(context)).toBe(true);
    });

    it('InternalGuard rejects the old hardcoded secrets', () => {
      for (const secret of ['marad-internal-secret-for-webhooks', 'secret123']) {
        const { context } = contextFor({ 'x-internal-secret': secret });
        expect(() => new InternalGuard().canActivate(context)).toThrow(UnauthorizedException);
      }
    });

    it('InternalGuard accepts the configured secret', () => {
      const { context } = contextFor({ 'x-internal-secret': process.env.INTERNAL_SECRET! });
      expect(new InternalGuard().canActivate(context)).toBe(true);
    });
  });
});
