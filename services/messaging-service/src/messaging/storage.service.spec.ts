import * as fs from 'fs';
import * as path from 'path';
import {
  MESSAGE_IMAGE_URL_TTL_SECONDS,
  StorageService,
  serveMessageImage,
  signMessageImageUrl,
  verifyMessageImageRequest,
} from './storage.service';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const NAME = '3f1c9a5e-8b2d-4c6f-9e1a-7d2b4c6e8f0a.jpg';

const parse = (url: string) => {
  const u = new URL(url);
  return { name: u.pathname.split('/').pop()!, exp: u.searchParams.get('exp')!, sig: u.searchParams.get('sig')! };
};

describe('chat image URLs (signed, expiring)', () => {
  it('signs a stored full URL and a bare name the same way', () => {
    const fromUrl = signMessageImageUrl(`http://localhost:3000/api/v1/media/messages/${NAME}`, NOW)!;
    const fromName = signMessageImageUrl(NAME, NOW)!;
    expect(fromUrl).toBe(fromName);
    expect(fromUrl).toMatch(new RegExp(`/media/messages/${NAME}\\?exp=\\d+&sig=[A-Za-z0-9_-]+$`));
  });

  it('accepts its own signature until expiry, rounded to the day', () => {
    const { name, exp, sig } = parse(signMessageImageUrl(NAME, NOW)!);
    expect(Number(exp) - NOW / 1000).toBeGreaterThan(MESSAGE_IMAGE_URL_TTL_SECONDS - 24 * 3600);
    expect(verifyMessageImageRequest(name, exp, sig, NOW)).toBe(true);
    expect(verifyMessageImageRequest(name, exp, sig, Number(exp) * 1000 + 1)).toBe(false);
  });

  it('is stable within a day, so clients can cache the image', () => {
    expect(signMessageImageUrl(NAME, NOW)).toBe(signMessageImageUrl(NAME, NOW + 3600_000));
  });

  it('rejects a tampered name, expiry or signature, and unsigned requests', () => {
    const { name, exp, sig } = parse(signMessageImageUrl(NAME, NOW)!);
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
    expect(verifyMessageImageRequest(other, exp, sig, NOW)).toBe(false);
    expect(verifyMessageImageRequest(name, String(Number(exp) + 86400), sig, NOW)).toBe(false);
    expect(verifyMessageImageRequest(name, exp, sig.slice(0, -2) + 'AA', NOW)).toBe(false);
    expect(verifyMessageImageRequest(name, undefined, undefined, NOW)).toBe(false);
  });

  it('refuses expiries far in the future, even if correctly signed', () => {
    // A leaked key or a bug must not mint permanent links: the window is capped.
    expect(verifyMessageImageRequest(NAME, String(Math.floor(NOW / 1000) + 365 * 86400), 'x', NOW)).toBe(false);
  });

  it('never signs or serves names outside the expected shape (path traversal)', () => {
    for (const bad of ['../.env', '..%2F.env', 'x.png', '.jpg', '']) {
      expect(signMessageImageUrl(bad, NOW)).toBeNull();
    }
    // Serving checks the requested name itself: no slash, dot-dot or other extension.
    for (const bad of ['../.env', '..%2F.env', 'a/b.jpg', '../x.jpg', 'x.png', '.jpg', '']) {
      expect(verifyMessageImageRequest(bad, '9999999999', 'x', NOW)).toBe(false);
    }
  });

  it('still signs legacy "<millis>-<random>.jpg" names already stored in the database', () => {
    expect(signMessageImageUrl('http://h/api/v1/media/messages/1732700000000-123456789.jpg', NOW)).not.toBeNull();
  });

  it('returns null for text messages', () => {
    expect(signMessageImageUrl(null, NOW)).toBeNull();
  });
});

describe('serveMessageImage', () => {
  const file = path.join(StorageService.uploadDir, NAME);
  beforeAll(() => {
    fs.mkdirSync(StorageService.uploadDir, { recursive: true });
    fs.writeFileSync(file, 'jpeg-bytes');
  });
  afterAll(() => fs.rmSync(file, { force: true }));

  const call = (url: string) => {
    const u = new URL(url, 'http://x');
    const res: any = { headersSent: false };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.sendFile = jest.fn();
    serveMessageImage({ path: u.pathname.replace('/media/messages', ''), query: Object.fromEntries(u.searchParams) } as any, res);
    return res;
  };

  it('serves a correctly signed request with private caching headers', () => {
    const signed = signMessageImageUrl(NAME)!;
    const res = call(new URL(signed).pathname.replace(/^.*\/media/, '/media') + new URL(signed).search);
    expect(res.status).not.toHaveBeenCalled();
    const [sentPath, options] = res.sendFile.mock.calls[0];
    expect(sentPath).toBe(file);
    expect(options.headers['Cache-Control']).toMatch(/^private, max-age=\d+$/);
    expect(options.headers['Referrer-Policy']).toBe('no-referrer');
  });

  it('answers 403 to the plain (unsigned) URL that used to be public', () => {
    const res = call(`/media/messages/${NAME}`);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.sendFile).not.toHaveBeenCalled();
  });
});
