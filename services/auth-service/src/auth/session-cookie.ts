import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

/**
 * Browser sessions: the refresh token travels only in an HttpOnly cookie, so script injected
 * into the web app (XSS) can never read it. The access token stays in the page's memory.
 *
 * Opt-in per request with `X-Session-Cookie: 1`. That custom header also makes every
 * cross-site call a CORS preflight, which the gateway only allows for listed origins — so
 * a forged form post cannot use the cookie (CSRF). Mobile clients keep body tokens.
 */
export const REFRESH_COOKIE = 'marad_rt';
/** Not secret: tells the web app (and its route guard) that a session exists. */
export const SESSION_FLAG_COOKIE = 'marad_session';
const MAX_AGE_SECONDS = 7 * 24 * 3600;

export function wantsSessionCookie(req: { headers?: Record<string, unknown> }): boolean {
  return req.headers?.['x-session-cookie'] === '1';
}

export function readRefreshCookie(req: { headers?: Record<string, unknown> }): string | undefined {
  if (!wantsSessionCookie(req)) return undefined;
  const header = req.headers?.cookie;
  if (typeof header !== 'string') return undefined;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === REFRESH_COOKIE) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function attributes(path: string, maxAge: number, httpOnly: boolean, sameSite: 'Strict' | 'Lax'): string {
  const parts = [`Path=${path}`, `Max-Age=${maxAge}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  // Browsers accept Secure cookies on http://localhost; set COOKIE_SECURE=false only for
  // plain-http testing from another host (e.g. a phone on the LAN).
  if (process.env.COOKIE_SECURE !== 'false') parts.push('Secure');
  // e.g. ".example.com" when the web app and the API are on different subdomains.
  if (process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  return parts.join('; ');
}

export function sessionCookies(refreshToken: string): string[] {
  return [
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; ${attributes('/api/v1/auth', MAX_AGE_SECONDS, true, 'Strict')}`,
    `${SESSION_FLAG_COOKIE}=1; ${attributes('/', MAX_AGE_SECONDS, false, 'Lax')}`,
  ];
}

export function clearedSessionCookies(): string[] {
  return [
    `${REFRESH_COOKIE}=; ${attributes('/api/v1/auth', 0, true, 'Strict')}`,
    `${SESSION_FLAG_COOKIE}=; ${attributes('/', 0, false, 'Lax')}`,
  ];
}

/** Moves `tokens.refresh_token` from the JSON body into the cookie when the client asked. */
@Injectable()
export class SessionCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    return next.handle().pipe(
      map((body: any) => {
        const refreshToken = body?.tokens?.refresh_token;
        if (!wantsSessionCookie(req) || typeof refreshToken !== 'string') return body;
        res.setHeader('Set-Cookie', sessionCookies(refreshToken));
        const { refresh_token: _omitted, ...tokens } = body.tokens;
        return { ...body, tokens };
      }),
    );
  }
}
