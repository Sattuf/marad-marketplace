/**
 * أدوات الأمان المشتركة — Shared security helpers
 *
 * NOTE: this file is intentionally duplicated in every NestJS service until
 * the shared `packages/common` workspace lands (see docs/REBUILD_PLAN.md, phase 1).
 * Keep all copies identical.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createPublicKey, KeyObject, timingSafeEqual } from 'crypto';

const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Reads a secret from the environment and refuses to continue without it.
 * No defaults: a default secret committed to the repo is a public secret.
 */
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  if (process.env.NODE_ENV === 'production' && value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`);
  }
  return value;
}

/** Fails fast at boot instead of on the first request. */
export function assertRequiredSecrets(...names: string[]): void {
  for (const name of names) requireSecret(name);
}

const DEV_CORS_ORIGINS = ['http://localhost:3100', 'http://localhost:8080', 'http://localhost:5000'];

/** Allowed browser origins, from CORS_ORIGINS (comma separated). None by default in production. */
export function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS;
  if (configured) {
    return configured.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return process.env.NODE_ENV === 'production' ? [] : DEV_CORS_ORIGINS;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Constant-time string comparison (hashing first removes the length leak). */
export function safeEqual(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || !provided || !expected) {
    return false;
  }
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isInternalRequest(headers: Record<string, unknown>): boolean {
  return safeEqual(headers['x-internal-secret'], requireSecret('INTERNAL_SECRET'));
}

export function assertInternalRequest(headers: Record<string, unknown>): void {
  if (!isInternalRequest(headers)) {
    throw new UnauthorizedException('Invalid internal secret');
  }
}

/** Headers for service-to-service calls. */
export function internalHeaders(): Record<string, string> {
  return { 'x-internal-secret': requireSecret('INTERNAL_SECRET') };
}

export interface AuthUser {
  userId: string;
  email?: string;
  role: string;
}

const jwtService = new JwtService();

/** Claims every access token must carry (set by auth-service, checked by every service). */
export const ACCESS_TOKEN_ISSUER = 'marad-auth';
export const ACCESS_TOKEN_AUDIENCE = 'marad-api';

let publicKeys: Map<string, KeyObject> | null = null;

/**
 * Access tokens are signed by auth-service with an RSA private key (RS256) that no other
 * service holds; every service verifies them with the public keys in JWT_PUBLIC_JWKS
 * (a JWK Set on one line: {"keys":[{kty,n,e,kid,...}]}). Two keys may be listed during a
 * rotation; the token's `kid` header selects one, and an unknown `kid` is rejected.
 * Loaded once and validated at boot, so a bad key fails the deployment, not every request.
 */
export function loadPublicKeys(): Map<string, KeyObject> {
  if (publicKeys) return publicKeys;
  const raw = process.env.JWT_PUBLIC_JWKS;
  if (!raw) throw new Error('Missing required environment variable JWT_PUBLIC_JWKS');
  let set: { keys?: Array<Record<string, unknown>> };
  try {
    set = JSON.parse(raw);
  } catch {
    throw new Error('JWT_PUBLIC_JWKS is not valid JSON');
  }
  const keys = new Map<string, KeyObject>();
  for (const jwk of set.keys ?? []) {
    if (typeof jwk.kid !== 'string' || jwk.kty !== 'RSA' || (jwk.alg !== undefined && jwk.alg !== 'RS256')) {
      throw new Error('JWT_PUBLIC_JWKS: every key needs a kid, kty "RSA" and alg "RS256"');
    }
    keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }));
  }
  if (keys.size === 0 || keys.size > 2) throw new Error('JWT_PUBLIC_JWKS must contain one or two keys');
  publicKeys = keys;
  return keys;
}

/** Tests only: forget the cached keys after changing JWT_PUBLIC_JWKS. */
export function resetPublicKeysCache(): void {
  publicKeys = null;
}

/** The public key matching the token's `kid` header, or null. */
export function publicKeyFor(token: string): KeyObject | null {
  const decoded: any = jwtService.decode(token, { complete: true });
  const kid = decoded?.header?.kid;
  return typeof kid === 'string' ? loadPublicKeys().get(kid) ?? null : null;
}

export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/** Verifies signature (RS256 only), expiry, issuer and audience of an access token. */
export function verifyAccessToken(token: string): AuthUser {
  let payload: any;
  try {
    const key = publicKeyFor(token);
    if (!key) throw new Error('unknown key');
    payload = jwtService.verify(token, {
      publicKey: key as any,
      algorithms: ['RS256'],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }
  if (!payload || typeof payload.sub !== 'string') {
    throw new UnauthorizedException('Invalid token payload');
  }
  return { userId: payload.sub, email: payload.email, role: payload.role ?? 'user' };
}

/** Requires a valid access token; exposes it as `req.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization token missing');
    }
    request.user = verifyAccessToken(token);
    return true;
  }
}

/** Requires a valid access token with the admin role. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      new JwtAuthGuard().canActivate(context);
    }
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}

/** Restricts an endpoint to other services holding INTERNAL_SECRET. */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertInternalRequest(context.switchToHttp().getRequest().headers ?? {});
    return true;
  }
}
