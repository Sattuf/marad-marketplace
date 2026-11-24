import { of, lastValueFrom } from 'rxjs';
import { readRefreshCookie, SessionCookieInterceptor, sessionCookies } from './session-cookie';

const ctx = (headers: Record<string, string>) => {
  const res = { setHeader: jest.fn() };
  return { res, context: { switchToHttp: () => ({ getRequest: () => ({ headers }), getResponse: () => res }) } as any };
};

describe('browser session cookie', () => {
  const body = { user: { id: 'u1' }, tokens: { access_token: 'a', refresh_token: 'r.t' } };

  it('moves the refresh token into an HttpOnly, Strict cookie scoped to /api/v1/auth', async () => {
    const { res, context } = ctx({ 'x-session-cookie': '1' });
    const out = await lastValueFrom(new SessionCookieInterceptor().intercept(context, { handle: () => of(body) }));
    expect(out.tokens).toEqual({ access_token: 'a' });
    const [refresh, flag] = res.setHeader.mock.calls[0][1];
    expect(refresh).toMatch(/^marad_rt=r\.t; Path=\/api\/v1\/auth; .*SameSite=Strict; HttpOnly; Secure/);
    expect(flag).toMatch(/^marad_session=1; Path=\/;/);
    expect(flag).not.toContain('HttpOnly');
  });

  it('leaves mobile clients (no opt-in header) with body tokens and no cookie', async () => {
    const { res, context } = ctx({});
    const out = await lastValueFrom(new SessionCookieInterceptor().intercept(context, { handle: () => of(body) }));
    expect(out.tokens.refresh_token).toBe('r.t');
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('reads the cookie only together with the opt-in header (CSRF: forces a CORS preflight)', () => {
    const cookie = `other=1; marad_rt=${encodeURIComponent('abc.def')}`;
    expect(readRefreshCookie({ headers: { cookie, 'x-session-cookie': '1' } })).toBe('abc.def');
    expect(readRefreshCookie({ headers: { cookie } })).toBeUndefined();
  });

  it('honours COOKIE_DOMAIN and COOKIE_SECURE', () => {
    process.env.COOKIE_DOMAIN = '.example.com';
    process.env.COOKIE_SECURE = 'false';
    const [refresh] = sessionCookies('x');
    expect(refresh).toContain('Domain=.example.com');
    expect(refresh).not.toContain('Secure');
    delete process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_SECURE;
  });
});
