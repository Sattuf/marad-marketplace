import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { requireSecret, safeEqual } from '../common/security';
// sharp's typings declare a default export, but require('sharp') returns the function
// itself: a default import compiles to sharp_1.default, which is undefined at runtime
// (these services do not use esModuleInterop). Types from the typings, value from require.
const sharp: typeof import('sharp').default = require('sharp');

/**
 * Public URL of a locally stored file (STORAGE_PROVIDER is not "s3", i.e. development):
 * served by this service under /media and reached through the gateway, so phones and
 * browsers load it from the same address as the API. PUBLIC_API_URL is the gateway as
 * clients see it (http://<computer's Wi-Fi IP>:3000/api/v1 when testing on a phone).
 */
export function localMediaUrl(kind: string, filename: string): string {
  const base = (process.env.PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
  return `${base}/media/${kind}/${filename}`;
}

/**
 * Chat images are private to the two members of a conversation, but <img> tags cannot
 * send a bearer token. So the URL itself is the capability: an unguessable file name
 * plus an HMAC over (name, expiry). URLs are signed only when a member reads or sends
 * messages (the endpoints already check membership), and stop working after expiry.
 */
export const MESSAGE_IMAGE_URL_TTL_SECONDS = 7 * 24 * 3600;
const DAY_SECONDS = 24 * 3600;
// UUID names (new) and the older "<millis>-<random>.jpg" names; nothing else is served.
const MESSAGE_IMAGE_NAME = /^[A-Za-z0-9-]{1,64}\.jpg$/;

function mediaUrlKey(): Buffer {
  // Derived from INTERNAL_SECRET with a fixed label: no new secret to deploy, and the
  // derived key is useless for calling internal endpoints.
  return createHmac('sha256', requireSecret('INTERNAL_SECRET')).update('marad/message-image-url/v1').digest();
}

function signature(name: string, exp: number): string {
  return createHmac('sha256', mediaUrlKey()).update(`${name}\n${exp}`).digest('base64url');
}

/** Stored image_url (full URL or bare name) → time-limited signed URL, or null. */
export function signMessageImageUrl(stored: string | null | undefined, nowMs = Date.now()): string | null {
  if (!stored) return null;
  const name = stored.split('?')[0].split('/').pop() ?? '';
  if (!MESSAGE_IMAGE_NAME.test(name)) return null;
  // Expiry is rounded to the day, so one image has one URL per day (client caches work).
  const exp = Math.floor(nowMs / 1000 / DAY_SECONDS) * DAY_SECONDS + MESSAGE_IMAGE_URL_TTL_SECONDS;
  return `${localMediaUrl('messages', name)}?exp=${exp}&sig=${signature(name, exp)}`;
}

export function verifyMessageImageRequest(name: string, exp: unknown, sig: unknown, nowMs = Date.now()): boolean {
  if (!MESSAGE_IMAGE_NAME.test(name) || typeof exp !== 'string' || !/^\d{1,12}$/.test(exp)) return false;
  const expires = Number(exp);
  const now = nowMs / 1000;
  if (expires <= now || expires > now + MESSAGE_IMAGE_URL_TTL_SECONDS + DAY_SECONDS) return false;
  return safeEqual(sig, signature(name, expires));
}

/** Express handler for GET /media/messages/:name — replaces the old public static folder. */
export function serveMessageImage(req: Request, res: Response): void {
  let name: string;
  try {
    name = decodeURIComponent(req.path.replace(/^\/+/, ''));
  } catch {
    name = '';
  }
  if (!verifyMessageImageRequest(name, req.query.exp, req.query.sig)) {
    res.status(403).json({ statusCode: 403, message: 'Forbidden' });
    return;
  }
  const remaining = Math.max(0, Number(req.query.exp) - Math.floor(Date.now() / 1000));
  res.sendFile(path.join(StorageService.uploadDir, name), {
    headers: {
      // Private: shared caches and CDNs must not keep a copy beyond the signed lifetime.
      'Cache-Control': `private, max-age=${Math.min(remaining, DAY_SECONDS)}`,
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
    dotfiles: 'deny',
  }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: 'Not found' });
  });
}

@Injectable()
export class StorageService {
  static readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly uploadDir = StorageService.uploadDir;

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    // 122 random bits: the name is half of the access capability (see signMessageImageUrl).
    const filename = `${randomUUID()}.jpg`;
    const filepath = path.join(this.uploadDir, filename);

    await sharp(file.buffer)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    // Stored unsigned; signed per request by the message mappers.
    return localMediaUrl('messages', filename);
  }
}
